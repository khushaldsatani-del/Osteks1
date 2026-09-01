import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  PageNumber,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  TableLayoutType,
  convertMillimetersToTwip,
} from "docx";
import { getDocPreviewContent } from "./docPreviewContent";

// A real .docx file (via the `docx` library) instead of the HTML-as-.doc
// trick used before. A genuine OOXML section header/footer is part of the
// file format itself, so Word repeats it on every page of the section by
// construction — there's no per-page wiring to get wrong. The previous
// hand-written HTML approximation (mso-element:header/footer) could not be
// made to reliably repeat past page 1 in real Word no matter how the
// section/header ids were arranged, which is why this file replaces it.

const FONT_FAMILY = "Calibri";
const BODY_SIZE = 21; // 10.5pt in half-points (docx font sizes are half-points)

const PAGE_WIDTH_MM = 210;
const MARGIN_LEFT_MM = 19;
const MARGIN_RIGHT_MM = 19;
// Usable width between the left/right margins — tables are given this exact
// width (rather than a percentage) so label/value columns keep their
// intended proportions instead of Word auto-shrinking the value column,
// which was wrapping long values (e.g. Anlieferzustand) into far more lines
// than the preview shows and pushing content onto extra pages.
const CONTENT_WIDTH_TWIPS = convertMillimetersToTwip(PAGE_WIDTH_MM - MARGIN_LEFT_MM - MARGIN_RIGHT_MM);

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};

const twips = (pt) => Math.round(pt * 20);
const halfPt = (pt) => Math.round(pt * 2);

function run(text, { bold = false, size = BODY_SIZE, underline = false } = {}) {
  return new TextRun({ text, bold, size, font: FONT_FAMILY, underline: underline ? {} : undefined });
}

// One paragraph, multiple lines joined with real line breaks (not separate
// paragraphs), so there's no extra paragraph spacing between them — matches
// how the recipient block/intro lines look in the preview.
function linesParagraph(lines, { size = BODY_SIZE, bold = false, alignment = AlignmentType.LEFT, before = 0, after = 0 } = {}) {
  const list = Array.isArray(lines) ? lines : [lines];
  return new Paragraph({
    alignment,
    spacing: { before: twips(before), after: twips(after) },
    children: list.map((line, i) => new TextRun({ text: line, bold, size, font: FONT_FAMILY, break: i > 0 ? 1 : 0 })),
  });
}

function cell(children, { widthTwips } = {}) {
  return new TableCell({
    width: widthTwips ? { size: widthTwips, type: WidthType.DXA } : undefined,
    margins: { top: 0, bottom: 100, left: 0, right: 120 },
    borders: NO_BORDERS,
    children: Array.isArray(children) ? children : [children],
  });
}

function labelValueTable(rows, { labelWidthPt, bold = false, indentPt = 0, size = BODY_SIZE } = {}) {
  const labelWidthTwips = twips(labelWidthPt);
  const tableWidthTwips = CONTENT_WIDTH_TWIPS - twips(indentPt);
  const valueWidthTwips = tableWidthTwips - labelWidthTwips;

  return new Table({
    width: { size: tableWidthTwips, type: WidthType.DXA },
    columnWidths: [labelWidthTwips, valueWidthTwips],
    layout: TableLayoutType.FIXED,
    indent: { size: twips(indentPt), type: WidthType.DXA },
    borders: NO_BORDERS,
    rows: rows.map(([label, value]) => {
      const lines = Array.isArray(value) ? value : [value];
      return new TableRow({
        children: [
          cell(new Paragraph({ children: [run(label, { bold, size })] }), { widthTwips: labelWidthTwips }),
          cell(
            new Paragraph({
              children: lines.map(
                (line, i) => new TextRun({ text: line, bold, size, font: FONT_FAMILY, break: i > 0 ? 1 : 0 })
              ),
            }),
            { widthTwips: valueWidthTwips }
          ),
        ],
      });
    }),
  });
}

// `overrides.recipientLines` / `overrides.headingRows` carry live Firma
// Information values (Projekt, recipient address, Angebot Nr.) through to
// the export — falls back to the static sample content when not provided.
// `overrides.offerDetailsRows` is different on purpose: it has no fallback,
// since an empty/partial Offer Details form should produce an empty/partial
// block here, not static sample rows. Labels in `offerDetailsRows` arrive
// already translated (DocPreview.jsx resolves them from field keys at
// export time), so this file itself never needs to know the language for
// those — only for the rest of the letter content below.
export async function buildDocxBlob(specMode, overrides = {}, language = "DE") {
  const {
    LETTERHEAD,
    RETURN_ADDRESS,
    RECIPIENT_LINES,
    CONTACT_ROWS,
    getTodayDateLine,
    HEADING_ROWS,
    SALUTATION,
    INTRO_LINES,
    SPEC_FIELD_ROWS,
    PAGE1_DISCLAIMER,
    WITHOUT_SPEC_NOTE,
    WITH_SPEC_NOTE,
    PAGE2_BOLD_PARAGRAPHS,
    TERMS_ROWS,
    PRICE_VALIDITY_LABEL,
    getPriceValidityDateLine,
    CLOSING_LINE,
  } = getDocPreviewContent(language);

  // The With/Without Specification toggle only changes this one paragraph
  // now — the Coating/Pre-treatment/etc. field list below is always
  // included, matching the on-screen preview.
  const specNote = specMode === "with" ? WITH_SPEC_NOTE : WITHOUT_SPEC_NOTE;
  const page2Paragraphs = [specNote, ...PAGE2_BOLD_PARAGRAPHS];

  // Same live "Angebotsgültigkeit + 3 months" row DocPreview.jsx's own
  // preview appends — see docPreviewContent.js's getPriceValidityDateLine.
  // overrides.angebotsgueltigkeitDigits is DocPreview.jsx's own live value
  // for whichever image is active, passed straight through here so the
  // download always matches the preview exactly.
  const termsRows = [...TERMS_ROWS, [PRICE_VALIDITY_LABEL, getPriceValidityDateLine(overrides.angebotsgueltigkeitDigits)]];

  const recipientLines = overrides.recipientLines ?? RECIPIENT_LINES;
  const headingRows = overrides.headingRows ?? HEADING_ROWS;
  const offerDetailsRows = overrides.offerDetailsRows ?? [];

  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 0 },
        children: [new TextRun({ text: LETTERHEAD.company, size: halfPt(20), font: FONT_FAMILY })],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: LETTERHEAD.sub, size: halfPt(8), font: FONT_FAMILY })],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, font: FONT_FAMILY })],
      }),
    ],
  });

  const body = [
    new Paragraph({
      spacing: { after: twips(22) },
      children: [new TextRun({ text: RETURN_ADDRESS, size: 14, font: FONT_FAMILY, underline: {} })],
    }),

    linesParagraph(recipientLines, { after: 14 }),

    ...CONTACT_ROWS.map(
      ([label, value]) =>
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: twips(1) },
          children: [run(`${label}   ${value}`)],
        })
    ),

    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: twips(18) },
      children: [run(getTodayDateLine())],
    }),

    labelValueTable(headingRows, { labelWidthPt: 90, bold: true }),

    new Paragraph({
      spacing: { before: twips(8), after: twips(12) },
      children: [run(SALUTATION)],
    }),

    linesParagraph(INTRO_LINES, { after: 16 }),

    labelValueTable(SPEC_FIELD_ROWS, { labelWidthPt: 118 }),

    ...(offerDetailsRows.length > 0
      ? [labelValueTable(offerDetailsRows, { labelWidthPt: 150, bold: true, indentPt: 24 })]
      : []),

    new Paragraph({
      children: [run(PAGE1_DISCLAIMER, { bold: true })],
    }),

    // No manual page break here anymore — Word's own layout engine flows
    // this naturally onto whichever page has room, exactly like the on-
    // screen preview's own real-height pagination now does (see
    // DocPreview.jsx). Still the same section, so the header/footer above
    // keeps repeating on every page regardless of how many there end up being.
    ...page2Paragraphs.map(
      (text) =>
        new Paragraph({
          spacing: { after: twips(12) },
          children: [run(text, { bold: true })],
        })
    ),

    labelValueTable(termsRows, { labelWidthPt: 96 }),

    new Paragraph({ children: [run(CLOSING_LINE)] }),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT_FAMILY },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(PAGE_WIDTH_MM),
              height: convertMillimetersToTwip(297),
            },
            margin: {
              top: convertMillimetersToTwip(24),
              right: convertMillimetersToTwip(MARGIN_RIGHT_MM),
              bottom: convertMillimetersToTwip(22),
              left: convertMillimetersToTwip(MARGIN_LEFT_MM),
              header: convertMillimetersToTwip(11),
              footer: convertMillimetersToTwip(10),
            },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children: body,
      },
    ],
  });

  return Packer.toBlob(doc);
}
