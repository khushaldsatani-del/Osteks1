import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  AlignmentType,
  VerticalAlign,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  LineRuleType,
  TableLayoutType,
  convertMillimetersToTwip,
} from "docx";
import { formatDateDots, ASSESSMENT_LABEL } from "./TestReportPreview";
import { buildDocData, ENTHAFTUNG_TEXT, DEFAULT_DELAMINATION_VERFAHREN } from "./testReportDocData";
import { groupColumns, orderStacked, applyResizeScale, fitWithin, imageKey } from "./testReportImageLayout";

// A real .docx export of the Step 5 "Prüfbericht" preview, mirroring the
// coating-calculator side's DocPreview.jsx / buildDocx.js pattern (real
// OOXML via the `docx` library, not an HTML-as-.doc approximation). The
// document's structure — which cycles appear, which photos belong to each,
// the conditional ISO 4628-8 delamination sections — is decided by
// buildDocData() (shared with the on-screen preview via testReportDocData.js)
// so the two never drift apart. Static German prose is transcribed 1:1 from
// TestReportPreview.jsx's JSX in the same order.
//
// UNIT CONVERSION — geometry/font values are derived from the preview's CSS
// pixel values via 96px = 1in = 1440 twips. Both sides render Arial now, but
// Word's and Chrome's layout engines still measure the same text at
// slightly different widths/line-heights, so this is "as close as two
// layout engines get", not pixel parity.
const px = (n) => Math.round(n * 15); // 1440 twips/in ÷ 96 px/in
const pxPt = (n) => Math.round(n * 0.75); // for values genuinely in points (e.g. border "space")
const pxHalfPt = (n) => Math.round(n * 1.5); // font-size px -> half-points
const ptHalfPt = (n) => Math.round(n * 2); // a LITERAL point size (e.g. "10" in Word's font-size box) -> half-points

const FONT_FAMILY = "Arial";
const BODY_SIZE = 20; // 10pt (Word's own "10" font-size), explicitly requested

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const PAGE_WIDTH_TWIPS = convertMillimetersToTwip(PAGE_WIDTH_MM);

const MARGIN_TWIPS = 1440; // 1 inch
const CONTENT_WIDTH_TWIPS = PAGE_WIDTH_TWIPS - MARGIN_TWIPS * 2;

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};
const GRID_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" };
const GRID_BORDERS = {
  top: GRID_BORDER,
  bottom: GRID_BORDER,
  left: GRID_BORDER,
  right: GRID_BORDER,
  insideHorizontal: GRID_BORDER,
  insideVertical: GRID_BORDER,
};
// The two results tables get a bolder, solid black grid instead of the
// pale default above — the light gray was nearly invisible once the
// Bewertung column started filling solid green/red (see .doc-results-table
// in testReportPreview.css, which uses the matching #1a1a1a on-screen).
const RESULTS_BORDER = { style: BorderStyle.SINGLE, size: 6, color: "1A1A1A" };
const RESULTS_BORDERS = {
  top: RESULTS_BORDER,
  bottom: RESULTS_BORDER,
  left: RESULTS_BORDER,
  right: RESULTS_BORDER,
  insideHorizontal: RESULTS_BORDER,
  insideVertical: RESULTS_BORDER,
};
// A photo's in-cell alignment override (left/center/right, from the
// preview's alignment buttons — see testReportImageLayout.js's
// IMAGE_ALIGN_VALUES) maps straight onto the image paragraph's own
// alignment; "left" (an absent/unset override) is the default.
const IMAGE_ALIGNMENT = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
};

// .doc-photo-box { border: 1px solid #1a1a1a } — a black frame around the
// whole group, no rules between the photos inside it.
const BLACK_BORDER = { style: BorderStyle.SINGLE, size: 6, color: "1A1A1A" };
const PHOTO_BOX_BORDERS = {
  top: BLACK_BORDER,
  bottom: BLACK_BORDER,
  left: BLACK_BORDER,
  right: BLACK_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};
// .doc-table th, .doc-table td { padding: 8px; }
const CELL_MARGINS = { top: px(8), bottom: px(8), left: px(8), right: px(8) };

function run(text, { bold = false, size = BODY_SIZE, italics = false, color } = {}) {
  return new TextRun({ text, bold, italics, size, font: FONT_FAMILY, color });
}

function spacer(px_) {
  return new Paragraph({ spacing: { line: px(px_), lineRule: LineRuleType.EXACT }, children: [] });
}

function cell(children, { widthTwips, bottomTwips = px(8) } = {}) {
  return new TableCell({
    width: widthTwips ? { size: widthTwips, type: WidthType.DXA } : undefined,
    margins: { top: 0, bottom: bottomTwips, left: 0, right: px(16) },
    borders: NO_BORDERS,
    children: Array.isArray(children) ? children : [children],
  });
}

function multiLineParagraph(content, { size = BODY_SIZE } = {}) {
  if (typeof content === "string") {
    return new Paragraph({ children: [run(content, { size })] });
  }
  const children = [];
  content.forEach((segments, lineIndex) => {
    segments.forEach((seg, segIndex) => {
      children.push(
        new TextRun({ text: seg.text, bold: !!seg.bold, size, font: FONT_FAMILY, break: lineIndex > 0 && segIndex === 0 ? 1 : 0 })
      );
    });
  });
  return new Paragraph({ children });
}

function infoRow(label, content, labelWidthTwips, valueWidthTwips) {
  return new TableRow({
    children: [
      cell(new Paragraph({ children: [run(label, { bold: true })] }), { widthTwips: labelWidthTwips, bottomTwips: px(22) }),
      cell(multiLineParagraph(content), { widthTwips: valueWidthTwips, bottomTwips: px(22) }),
    ],
  });
}

function heading(text, { size, before = 24, after = 8, underline = false, pageBreakBefore = false, indentPx = 0 } = {}) {
  return new Paragraph({
    pageBreakBefore,
    // A heading should never be the last line on a page, split from the
    // content it introduces — Word's own "keep with next" / "keep lines
    // together", the .docx counterpart of the preview's keepWithNext.
    keepNext: true,
    keepLines: true,
    indent: indentPx ? { left: px(indentPx) } : undefined,
    spacing: { before: px(before), after: px(after) },
    children: [new TextRun({ text, bold: true, size, font: FONT_FAMILY, underline: underline ? {} : undefined })],
  });
}

// .doc-p { margin: 0 0 16px } / .doc-tight { margin-bottom: 4px } /
// .doc-flush { margin-bottom: 0 } — `flush` for a run of label/value lines
// meant to read as one unbroken block (no blank line anywhere in the run).
function bodyParagraph(text, { tight = false, flush = false, bold = false, keepNext = false } = {}) {
  return new Paragraph({
    keepNext,
    spacing: { after: flush ? 0 : px(tight ? 4 : 16) },
    children: [run(text, { bold })],
  });
}

function mixedParagraph(segments, { tight = false } = {}) {
  return new Paragraph({
    spacing: { after: px(tight ? 4 : 16) },
    children: segments.map((seg) => run(seg.text, { bold: !!seg.bold })),
  });
}

function indentedLines(lines, { indentPx = 24, before = 0, after = 16, keepNext = false } = {}) {
  return new Paragraph({
    keepNext,
    indent: { left: px(indentPx) },
    spacing: { before: px(before), after: px(after) },
    children: lines.flatMap((line, i) => [...(i > 0 ? [new TextRun({ text: "", break: 1 })] : []), run(line)]),
  });
}

// `rowGapPx` is the tight 2px list rhythm by default; pass a bigger value
// (e.g. 16, a full blank-line gap) for rows that read as separate
// statements rather than one dense list — see the Sollvorgaben block,
// where the 2nd/3rd rows pass an empty label so their value keeps the same
// left edge as the first.
function definitionTable(rows, { indentPx = 0, labelWidthPx = 120, rowGapPx = 2 } = {}) {
  const tableWidthTwips = CONTENT_WIDTH_TWIPS - px(indentPx);
  const labelWidthTwips = px(labelWidthPx);
  const valueWidthTwips = tableWidthTwips - labelWidthTwips;
  return new Table({
    width: { size: tableWidthTwips, type: WidthType.DXA },
    columnWidths: [labelWidthTwips, valueWidthTwips],
    indent: { size: px(indentPx), type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            cell(new Paragraph({ children: label ? [run(label)] : [] }), { widthTwips: labelWidthTwips, bottomTwips: px(rowGapPx) }),
            cell(new Paragraph({ children: [run(value)] }), { widthTwips: valueWidthTwips, bottomTwips: px(rowGapPx) }),
          ],
        })
    ),
  });
}

function headerCell(text, { widthTwips, size = pxHalfPt(12), alignment = AlignmentType.LEFT, verticalAlign } = {}) {
  return new TableCell({
    width: { size: widthTwips, type: WidthType.DXA },
    margins: CELL_MARGINS,
    verticalAlign,
    children: [new Paragraph({ alignment, children: [run(text, { bold: true, size })] })],
  });
}

function bodyCell(content, { widthTwips, size = pxHalfPt(12), alignment, bold = false, verticalAlign, shading, color } = {}) {
  const segments = typeof content === "string" ? [{ text: content, bold }] : content;
  return new TableCell({
    width: { size: widthTwips, type: WidthType.DXA },
    margins: CELL_MARGINS,
    verticalAlign,
    shading,
    children: [new Paragraph({ alignment, children: segments.map((seg) => run(seg.text, { bold: !!seg.bold, size, color })) })],
  });
}

function gridTable(rows, columnWidthsTwips, borders = GRID_BORDERS) {
  return new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: columnWidthsTwips,
    layout: TableLayoutType.FIXED,
    borders,
    rows,
  });
}

// ---------------------------------------------------------------------------
// Images. decodeImage() fetches + decodes an uploaded photo once;
// bitmapToImageRun() re-draws it onto a canvas at the target size and re-
// encodes as PNG (so the embedded bytes always match their declared type
// regardless of the source format — a WebP upload labeled "jpg" is exactly
// how images used to silently vanish from the export).
// ---------------------------------------------------------------------------
async function decodeImage(image) {
  if (!image?.url) return null;
  try {
    const res = await fetch(image.url);
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Test report Word export: could not decode an uploaded image (unsupported/corrupt format?) — skipping it.", err);
    return null;
  }
}

async function bitmapToImageRun(bitmap, maxWidthPx, maxHeightPx) {
  let width = maxWidthPx;
  let height = Math.round(width * (bitmap.height / bitmap.width));
  if (height > maxHeightPx) {
    height = maxHeightPx;
    width = Math.round(height * (bitmap.width / bitmap.height));
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  try {
    const pngBlob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), "image/png")
    );
    const buffer = await pngBlob.arrayBuffer();
    return new ImageRun({ data: buffer, type: "png", transformation: { width, height } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Test report Word export: could not encode an image — skipping it.", err);
    return null;
  }
}

async function loadImageRun(image, maxWidthPx, maxHeightPx) {
  const bitmap = await decodeImage(image);
  if (!bitmap) return null;
  const runEl = await bitmapToImageRun(bitmap, maxWidthPx, maxHeightPx);
  if (bitmap.close) bitmap.close();
  return runEl;
}

// One black-bordered photo box: the uploaded photo(s) laid out side by side
// or stacked by aspect ratio (same rules as the on-screen preview via
// groupColumns/orderStacked), each with an optional caption (e.g. a
// delamination "d = …" reading) underneath. Returns [] when the group has
// no images, else [table, spacer]. `imageSizeOverrides` is the same map the
// preview's resize handles write to (keyed by objectPath/blob URL — see
// testReportImageLayout.js's imageKey) — a manually resized photo renders
// at that same size here too, not just on screen.
async function photoBoxDocx(items, imageSizeOverrides = {}, groupCaptionText = null) {
  const present = (items || []).filter((it) => it.image?.url);
  if (present.length === 0) return [];

  const decoded = await Promise.all(
    present.map(async (it) => {
      const bitmap = await decodeImage(it.image);
      return { ...it, bitmap, ratio: bitmap ? bitmap.width / bitmap.height : 1.4 };
    })
  );
  const usable = decoded.filter((d) => d.bitmap);
  if (usable.length === 0) return [];

  const columns = groupColumns(usable.map((d) => d.ratio));
  const ordered = columns === 1 && usable.length === 2 ? orderStacked(usable, (d) => d.ratio) : usable;

  const GAP = px(10);
  const boxInnerTwips = CONTENT_WIDTH_TWIPS - px(14); // 1px border + 7px padding, both sides, ~
  let cellWidthTwips = columns === 2 ? Math.round((boxInnerTwips - GAP) / 2) : boxInnerTwips;
  let cellWidthPx = Math.round(cellWidthTwips / 15);
  const maxImgHeightPx = columns === 2 ? (usable.length > 2 ? 190 : 235) : usable.length === 1 ? 300 : 235;

  // A single column (a lone photo, OR a stacked pair — either way, no
  // side-by-side grid) at its untouched auto size gets a border that hugs
  // the widest photo actually in it, not one stretched to the page's full
  // printed content width — matching the preview's own `doc-photo-box--fit`
  // treatment. Narrower rows in the same stack just sit under that width,
  // not stretched to match it. The moment the user resizes or aligns ANY
  // photo in this box, the whole box widens back out to full width so that
  // control has room to actually move it (same rule the preview uses).
  let tableWidthTwips = CONTENT_WIDTH_TWIPS;
  if (columns === 1) {
    const hasActiveOverride = ordered.some((entry) => {
      const ov = imageSizeOverrides[imageKey(entry.image)];
      return ov && (ov.scale || ov.align);
    });
    if (!hasActiveOverride) {
      let maxAutoWidth = 0;
      ordered.forEach((entry) => {
        const auto = fitWithin(entry.ratio, cellWidthPx, maxImgHeightPx);
        maxAutoWidth = Math.max(maxAutoWidth, auto.width);
      });
      const fitCellPx = Math.round(maxAutoWidth) + 8; // + the cell's own 4px left/right margins
      cellWidthPx = fitCellPx;
      cellWidthTwips = px(fitCellPx);
      tableWidthTwips = cellWidthTwips;
    }
  }

  const perRow = columns === 2 ? 2 : 1;
  const totalRows = Math.ceil(ordered.length / perRow);

  // Word gives cell-level borders priority over the table's own — a cell
  // that declares NO_BORDERS on every side (as every other table in this
  // document does) suppresses the table's outer black border on that edge
  // too, which is why an earlier version of this box silently had no
  // border at all in the exported .docx despite looking bordered on
  // screen. Each cell now only gets a black edge where it actually sits on
  // the group's outer boundary — top row/bottom row/first column/last
  // column — and NO_BORDER on every internal edge, so the whole group
  // reads as one framed box with no grid lines between the photos inside
  // it, exactly like the preview's single `.doc-photo-box` wrapper.
  const edgeBorders = (rowIndex, colIndex, cols) => ({
    top: rowIndex === 0 ? BLACK_BORDER : NO_BORDER,
    bottom: rowIndex === totalRows - 1 ? BLACK_BORDER : NO_BORDER,
    left: colIndex === 0 ? BLACK_BORDER : NO_BORDER,
    right: colIndex === cols - 1 ? BLACK_BORDER : NO_BORDER,
  });

  const cellFor = async (entry, rowIndex, colIndex) => {
    const override = imageSizeOverrides[imageKey(entry.image)];
    // The size this photo would render at automatically (same "shrink to
    // fit" rule the on-screen preview's own auto layout uses) — a resize
    // override is a SCALE relative to THIS baseline, not an absolute
    // fraction of the column, so "50% smaller" looks 50% smaller here too,
    // not just on screen (see testReportImageLayout.js's fitWithin).
    const auto = fitWithin(entry.ratio, cellWidthPx, maxImgHeightPx);
    const sized = override?.scale ? applyResizeScale(auto.width, auto.height, override.scale, cellWidthPx) : auto;
    const alignment = IMAGE_ALIGNMENT[override?.align] || IMAGE_ALIGNMENT.left;

    const imgRun = await bitmapToImageRun(entry.bitmap, Math.round(sized.width), Math.round(sized.height));
    const children = [new Paragraph({ alignment, spacing: { after: 0 }, children: imgRun ? [imgRun] : [] })];
    if (entry.caption) {
      // A caption can be multiple lines (e.g. "{part} – nach N Zyklen" then
      // "Enthaftung d=…mm" underneath) — one Paragraph per line, tight
      // against each other, rather than one run that can't itself wrap.
      String(entry.caption)
        .split("\n")
        .forEach((line, i) => {
          children.push(
            new Paragraph({
              alignment,
              spacing: { before: i === 0 ? px(2) : 0, after: 0 },
              children: [run(line, { italics: true, size: pxHalfPt(10) })],
            })
          );
        });
    }
    return new TableCell({
      width: { size: cellWidthTwips, type: WidthType.DXA },
      margins: { top: px(4), bottom: px(4), left: px(4), right: px(4) },
      borders: edgeBorders(rowIndex, colIndex, perRow),
      children,
    });
  };

  const rows = [];
  for (let i = 0; i < ordered.length; i += perRow) {
    const rowIndex = i / perRow;
    // eslint-disable-next-line no-await-in-loop
    const cells = await Promise.all(ordered.slice(i, i + perRow).map((entry, colIndex) => cellFor(entry, rowIndex, colIndex)));
    while (columns === 2 && cells.length < 2) {
      const colIndex = cells.length;
      cells.push(
        new TableCell({
          width: { size: cellWidthTwips, type: WidthType.DXA },
          borders: edgeBorders(rowIndex, colIndex, perRow),
          children: [new Paragraph({ children: [] })],
        })
      );
    }
    rows.push(new TableRow({ children: cells }));
  }

  ordered.forEach((d) => d.bitmap.close && d.bitmap.close());

  const table = new Table({
    width: { size: tableWidthTwips, type: WidthType.DXA },
    columnWidths: columns === 2 ? [cellWidthTwips, cellWidthTwips] : [cellWidthTwips],
    layout: TableLayoutType.FIXED,
    borders: PHOTO_BOX_BORDERS,
    margins: { top: px(6), bottom: px(6), left: px(6), right: px(6) },
    rows,
  });

  // The whole box's auto-numbered "Abb. N …" caption (see
  // testReportDocData.js's buildCaptions) — one caption for the box as a
  // whole, not per photo, matching the preview's own groupCaption.
  const captionParas = groupCaptionText
    ? String(groupCaptionText)
        .split("\n")
        .map(
          (line, i) =>
            new Paragraph({
              spacing: { before: i === 0 ? px(4) : 0, after: 0 },
              children: [run(line, { italics: true, size: pxHalfPt(10) })],
            })
        )
    : [];

  return [table, ...captionParas, spacer(16)];
}

const enthaftungBlocks = (photoBlocks, verfahren) => [
  heading(ENTHAFTUNG_TEXT.heading, { size: pxHalfPt(13) }),
  bodyParagraph(`Verfahren: ${verfahren || DEFAULT_DELAMINATION_VERFAHREN}`, { tight: true, keepNext: true }),
  bodyParagraph(ENTHAFTUNG_TEXT.durchfuehrung, { keepNext: true }),
  indentedLines(ENTHAFTUNG_TEXT.lines, { keepNext: true }),
  ...photoBlocks,
];

export async function buildTestReportDocxBlob({
  reportInfo,
  subjectTask,
  testMethod,
  durationCycles,
  condensationDuration,
  cycleDurations,
  cyclesData,
  corrosionCrosscutData,
  condensationCrosscutData,
  constantClimateData,
  corrosionReferenceImages,
  condensationReferenceImages,
  evaluationSyncedRows,
  evaluationSummary,
  table2Rows,
  evaluationSummary2,
  cwtBegin,
  cwtEnd,
  imageSizeOverrides = {},
  captionOverrides = {},
  pageCount,
  todayFormatted,
}) {
  const docData = buildDocData({
    subjectTask,
    reportInfo,
    testMethod,
    durationCycles,
    condensationDuration,
    cycleDurations,
    captionOverrides,
    cyclesData,
    corrosionCrosscutData,
    condensationCrosscutData,
    constantClimateData,
    corrosionReferenceImages,
    condensationReferenceImages,
  });

  const rows1 = cycleDurations.filter((c) => c <= Number(durationCycles)).map((c) => ({ cycles: c, ...evaluationSyncedRows[c] }));

  const testObjectPart = reportInfo.testObjectPart || "—";
  const partNo = subjectTask.partNo || "—";
  const drawingNo = subjectTask.drawingNo || "—";
  const quantity = subjectTask.quantity || "—";
  const material = subjectTask.material || "—";
  const surface = subjectTask.surfaceProtectionType || "—";
  const hasDrawingNo = !!subjectTask.drawingNo?.trim();
  const cwtDurationCompact = (docData.condensationDuration || "240 h").replace(/\s+/g, "");

  // ---- Photo boxes (all resolved up front, same as the old figureBlocks) ----
  // Every box's auto-numbered "Abb. N …" caption comes from docData.captions
  // (see testReportDocData.js's buildCaptions) — the same map the preview
  // reads, so a caption the user edited there shows here too.
  const captionFor = (key) => docData.captions[key]?.full || null;

  const anlieferung1Box = await photoBoxDocx(docData.corrosionReference, imageSizeOverrides, captionFor("ref-corrosion"));
  const cycleContent = [];
  for (const c of docData.cycles) {
    if (!c.hasContent) continue;
    // eslint-disable-next-line no-await-in-loop
    const cycleBox = await photoBoxDocx(
      [
        { image: c.beforeImage, caption: null },
        { image: c.afterImage, caption: null },
      ],
      imageSizeOverrides,
      captionFor(`cycle-${c.cycles}-normal`)
    );
    cycleContent.push(
      heading(`Zustand nach ${c.cycles} Zyklen Korrosionswechseltest`, { size: pxHalfPt(12.5), underline: true }),
      ...cycleBox
    );
    if (c.delaminationImages.length) {
      // eslint-disable-next-line no-await-in-loop
      const enthBox = await photoBoxDocx(c.delaminationImages, imageSizeOverrides, captionFor(`cycle-${c.cycles}-delam`));
      cycleContent.push(...enthaftungBlocks(enthBox, c.delaminationVerfahren));
    }
  }
  const finalDelamBox = docData.finalDelaminationImages.length
    ? enthaftungBlocks(
        await photoBoxDocx(docData.finalDelaminationImages, imageSizeOverrides, captionFor("final-delam")),
        docData.finalDelaminationVerfahren
      )
    : [];
  const crosscut1Box = await photoBoxDocx(docData.corrosionCrosscut, imageSizeOverrides, captionFor("crosscut-corrosion"));
  const anlieferung2Box = await photoBoxDocx(docData.condensationReference, imageSizeOverrides, captionFor("ref-condensation"));
  const constantClimateBox = await photoBoxDocx(docData.constantClimate, imageSizeOverrides, captionFor("constant-climate"));
  const crosscut2Box = await photoBoxDocx(docData.condensationCrosscut, imageSizeOverrides, captionFor("crosscut-condensation"));

  // Matches .doc-signature-img's own max-width/max-height — sized well
  // above the old 220x70 so a scanned/photographed signature's thin pen
  // strokes aren't downscaled into a muddy, pixelated mess.
  const signatureRun = await loadImageRun(subjectTask.signature, 320, 110);

  const labelWidthTwips = px(160);
  const valueWidthTwips = CONTENT_WIDTH_TWIPS - labelWidthTwips;

  const infoTable = new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: [labelWidthTwips, valueWidthTwips],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      infoRow("Prüfbericht Nr.", reportInfo.reportNo || "—", labelWidthTwips, valueWidthTwips),
      infoRow(
        "Prüfgegenstand",
        [
          [
            { text: testObjectPart, bold: true },
            ...(partNo !== "—" ? [{ text: ` ${partNo}` }] : []),
            ...(subjectTask.drawingNo?.trim() ? [{ text: ` / ${subjectTask.drawingNo.trim()}` }] : []),
          ],
          [{ text: `${quantity} Stück mit KTL-Beschichtung` }],
          [{ text: reportInfo.description || "—" }],
        ],
        labelWidthTwips,
        valueWidthTwips
      ),
      infoRow("Bearbeiter", subjectTask.createdBy || "—", labelWidthTwips, valueWidthTwips),
    ],
  });

  const dateColWidth = Math.round(CONTENT_WIDTH_TWIPS / 3);
  const dateTable = gridTable(
    [
      new TableRow({
        children: ["Probeneingang", "Prüfbeginn", "Prüfende"].map((h) =>
          headerCell(h, { widthTwips: dateColWidth, alignment: AlignmentType.CENTER })
        ),
      }),
      new TableRow({
        children: [
          formatDateDots(reportInfo.sampleReceivedDate),
          formatDateDots(reportInfo.testStartDate),
          formatDateDots(reportInfo.plannedTestEndDate),
        ].map((v) => bodyCell(v, { widthTwips: dateColWidth, alignment: AlignmentType.CENTER })),
      }),
    ],
    [dateColWidth, dateColWidth, dateColWidth]
  );

  const sachverhaltHeaders = ["Prüfmuster", "Teile-Nr.", ...(hasDrawingNo ? ["Zeichnungs-Nr."] : []), "Stückzahl", "Werkstoff", "Oberfläche"];
  const sachverhaltColCount = sachverhaltHeaders.length;
  const sachverhaltColWidth = Math.round(CONTENT_WIDTH_TWIPS / sachverhaltColCount);
  const sachverhaltWidths = Array(sachverhaltColCount).fill(sachverhaltColWidth);
  const sachverhaltTable = gridTable(
    [
      new TableRow({
        children: sachverhaltHeaders.map((h) => headerCell(h, { widthTwips: sachverhaltColWidth, alignment: AlignmentType.CENTER })),
      }),
      new TableRow({
        children: [
          bodyCell(testObjectPart, { widthTwips: sachverhaltColWidth, bold: true }),
          bodyCell(partNo, { widthTwips: sachverhaltColWidth }),
          ...(hasDrawingNo ? [bodyCell(drawingNo, { widthTwips: sachverhaltColWidth })] : []),
          bodyCell(String(quantity), { widthTwips: sachverhaltColWidth }),
          bodyCell(material, { widthTwips: sachverhaltColWidth }),
          bodyCell(surface, { widthTwips: sachverhaltColWidth }),
        ],
      }),
    ],
    sachverhaltWidths
  );

  const numberedColWidths = [px(34), CONTENT_WIDTH_TWIPS - px(34)];
  const numberedTable = gridTable(
    [
      new TableRow({
        children: [
          headerCell("Nr.", { widthTwips: numberedColWidths[0], alignment: AlignmentType.CENTER }),
          headerCell("Prüfung", { widthTwips: numberedColWidths[1] }),
        ],
      }),
      ...(subjectTask.tests || []).map(
        (test, index) =>
          new TableRow({
            children: [
              bodyCell(`${index + 1}.`, { widthTwips: numberedColWidths[0], alignment: AlignmentType.CENTER }),
              bodyCell(test || "—", { widthTwips: numberedColWidths[1] }),
            ],
          })
      ),
    ],
    numberedColWidths
  );

  const resultsColWidths = [0.15, 0.32, 0.33, 0.2].map((f) => Math.round(CONTENT_WIDTH_TWIPS * f));
  // A passed row's Bewertung cell fills solid bright green, a failed one
  // solid red — same colors the on-screen preview uses (see
  // .doc-results-pass/.doc-results-fail in testReportPreview.css).
  const PASS_FILL = "00FF00";
  const FAIL_FILL = "FF0000";
  // Per-column font size in the downloaded .docx only — explicitly
  // requested distinct from the on-screen preview, which keeps its own
  // uniform 11.5px. `sizesPt` is [Prüfdauer, Ergebnis, Sollvorgaben,
  // Bewertung], applied to that column's header cell and every body cell.
  function resultsTable(headerLabel, rows, keyFn, sizesPt) {
    const sizes = sizesPt.map(ptHalfPt);
    return gridTable(
      [
        new TableRow({
          children: ["Prüfdauer", headerLabel, "Sollvorgaben / Anforderungen für Ofl X-633 nach TL 227", "Bewertung"].map(
            (h, i) =>
              headerCell(h, {
                widthTwips: resultsColWidths[i],
                size: sizes[i],
                alignment: AlignmentType.CENTER,
                verticalAlign: VerticalAlign.CENTER,
              })
          ),
        }),
        ...rows.map((row) => {
          const pass = row.assessment === "Fulfilled";
          return new TableRow({
            children: [
              bodyCell(keyFn(row), {
                widthTwips: resultsColWidths[0],
                size: sizes[0],
                alignment: AlignmentType.CENTER,
                verticalAlign: VerticalAlign.CENTER,
              }),
              bodyCell(row.result || "", {
                widthTwips: resultsColWidths[1],
                size: sizes[1],
                bold: true,
                alignment: AlignmentType.CENTER,
                verticalAlign: VerticalAlign.CENTER,
              }),
              bodyCell(row.requirement || "", {
                widthTwips: resultsColWidths[2],
                size: sizes[2],
                alignment: AlignmentType.CENTER,
                verticalAlign: VerticalAlign.CENTER,
              }),
              bodyCell(ASSESSMENT_LABEL[row.assessment] ?? row.assessment ?? "", {
                widthTwips: resultsColWidths[3],
                size: sizes[3],
                alignment: AlignmentType.CENTER,
                verticalAlign: VerticalAlign.CENTER,
                // White text on the red fill for contrast (matches the
                // preview's .doc-results-fail) — black default reads fine
                // on the lighter green, so pass leaves color unset.
                color: pass ? undefined : "FFFFFF",
                shading: { type: ShadingType.CLEAR, fill: pass ? PASS_FILL : FAIL_FILL, color: "auto" },
              }),
            ],
          });
        }),
      ],
      resultsColWidths,
      RESULTS_BORDERS
    );
  }

  const bannerBar = new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "999999", color: "auto" },
            margins: { top: px(14), bottom: px(14), left: 0, right: 0 },
            borders: NO_BORDERS,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [run("WERTE SCHAFFEN OHNE VERSCHWENDUNG", { size: pxHalfPt(13), bold: true, color: "FFFFFF" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: px(10) },
        children: [run("OSTEKS GMBH", { size: pxHalfPt(15), color: "8A8A8A", bold: true })],
      }),
      bannerBar,
    ],
  });

  const FOOTER_SIZE = pxHalfPt(10.5);
  const footerCellWidth = Math.round(CONTENT_WIDTH_TWIPS / 3);
  const footer = new Footer({
    children: [
      new Table({
        width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              cell(
                new Paragraph({
                  children: [run(`Erstellt durch ${subjectTask.createdBy || "—"}`, { size: FOOTER_SIZE, color: "6B6B6B" })],
                }),
                { widthTwips: footerCellWidth, bottomTwips: 0 }
              ),
              cell(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [run(`Erstellt am ${todayFormatted}`, { size: FOOTER_SIZE, color: "6B6B6B" })],
                }),
                { widthTwips: footerCellWidth, bottomTwips: 0 }
              ),
              cell(
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    run("Seite ", { size: FOOTER_SIZE, color: "6B6B6B" }),
                    new TextRun({ children: [PageNumber.CURRENT], size: FOOTER_SIZE, font: FONT_FAMILY, color: "6B6B6B" }),
                    run(" von ", { size: FOOTER_SIZE, color: "6B6B6B" }),
                    // A plain static number, not a NUMPAGES field — Word
                    // doesn't reliably recalculate that field on open (a
                    // file downloaded from a browser commonly opens in
                    // Protected View, where fields never auto-update at
                    // all), so it can show a stale/wrong total even though
                    // the field's own cached value here was correct. The
                    // real, already-measured page count is known at export
                    // time, so there's no reason to route it through a
                    // field Word might silently override.
                    run(String(pageCount || 1), { size: FOOTER_SIZE, color: "6B6B6B" }),
                  ],
                }),
                { widthTwips: footerCellWidth, bottomTwips: 0 }
              ),
            ],
          }),
        ],
      }),
    ],
  });

  const corrosionSection = docData.showCorrosion
    ? [
        heading("Untersuchung / Untersuchungsergebnisse", { size: pxHalfPt(14) }),
        heading("Anlieferungszustand", { size: pxHalfPt(13) }),
        ...anlieferung1Box,
        bodyParagraph(
          "Alle Musterteile zeigen im Anlieferungszustand vor der Korrosionsprüfung keine Auffälligkeiten in der Beschichtung."
        ),

        heading("1. Korrosionswechseltest PV 1210 Stand: 2016-02", { size: pxHalfPt(13), pageBreakBefore: true }),
        definitionTable(
          [
            ["Verfahren:", "Korrosionswechselprüfung nach VW PV 1210"],
            [
              "Prüfdauer:",
              `${durationCycles} Zyklen (6 Wochen) / ${formatDateDots(reportInfo.testStartDate)} – ${formatDateDots(reportInfo.plannedTestEndDate)}`,
            ],
          ],
          { labelWidthPx: 120 }
        ),
        spacer(16),

        indentedLines([
          "Ein Prüfzyklus (24 h) besteht aus:",
          "1) 4 h Salzsprühnebelprüfung, Prüfverfahren NSS nach DIN EN ISO 9227,",
          "2) 4 h Lagerung bei Normalklima ISO 554–23/50,",
          "3) 16 h Feucht-Wärme-Lagerung, Prüfklima CH nach DIN EN ISO 6270-2.",
          "(Nach jeweils 5 Zyklen folgt eine 2-tägige Ruhephase bei Normalklima ISO 554–23/50).",
        ]),

        indentedLines(["zu 1) Salzsprühnebelprüfung nach DIN EN ISO 9227"], { indentPx: 40, after: 4 }),
        definitionTable(
          [
            ["Prüflösung:", "5 +/- 1 % Natriumchlorid in VEW"],
            ["pH-Wert:", "6,5 bis 7,2"],
            ["Temperatur:", "35° C"],
            ["Verdüsung:", "1 bis 2 ml pro Stunde auf 80 cm² Fläche"],
          ],
          { indentPx: 64, labelWidthPx: 110 }
        ),
        spacer(16),

        indentedLines(["zu 2) Normalklima nach ISO 554–23/50 (vorm. DIN 50 014)"], { indentPx: 40, after: 4 }),
        definitionTable(
          [
            ["Temperatur:", "23 +/- 5° C"],
            ["rel. Feuchte:", "50 +/- 5° %"],
          ],
          { indentPx: 64, labelWidthPx: 110 }
        ),
        spacer(16),

        indentedLines(["zu 3) Kondenswasserkonstantklima nach DIN EN ISO 6270-2 CH **"], { indentPx: 40, after: 4 }),
        definitionTable(
          [
            ["Temperatur:", "40° +/- 2 °C"],
            ["rel. Feuchte:", "nahe 100 % mit Betauung der Proben"],
          ],
          { indentPx: 64, labelWidthPx: 110 }
        ),
        spacer(20),

        bodyParagraph("Gerätetechnik: Korrosionsprüfgerät SKBWF-C 1000 A-TR von Gebr. Liebisch GmbH Co. KG", { tight: true }),
        mixedParagraph([{ text: "Prüfteile: " }, { text: testObjectPart, bold: true }, { text: ` – ${quantity} Musterteile` }], {
          tight: true,
        }),
        bodyParagraph("Probenvorbereitung je Musterteil Anbringung von einer Ritzspur nach Clemen (Breite 0,5 mm)"),

        ...cycleContent,
        ...finalDelamBox,

        ...(crosscut1Box.length ? [heading("Gitterschnittprüfung:", { size: pxHalfPt(12.5), underline: true }), ...crosscut1Box] : []),

        resultsTable("Ergebnis nach Korrosionswechseltest nach PV 1210", rows1, (row) => `${row.cycles} Zyklen`, [10, 11, 11, 10]),
        spacer(16),

        new Paragraph({ spacing: { before: px(8), after: px(2) }, children: [run("Bewertung:", { bold: true })] }),
        bodyParagraph(
          evaluationSummary ||
            `Bei der Prüfung der Korrosionsbeständigkeit nach PV 1210 über ${durationCycles} Zyklen werden die Sollvorgaben erfüllt. Es liegt keine Flächen-, Kantenkorrosion und keine Blasenbildung vor.`
        ),
      ]
    : [];

  const condensationSection = docData.showCondensation
    ? [
        heading("2. Kondenswasserkonstantklimatest", { size: pxHalfPt(14), pageBreakBefore: docData.showCorrosion }),
        heading("Untersuchung / Untersuchungsergebnisse", { size: pxHalfPt(13) }),
        heading("Anlieferungszustand", { size: pxHalfPt(13) }),
        ...anlieferung2Box,
        bodyParagraph(
          "Alle Musterteile zeigen im Anlieferungszustand vor der Korrosionsprüfung keine Auffälligkeiten in der Beschichtung."
        ),

        heading("Untersuchung / Untersuchungsergebnisse", { size: pxHalfPt(13) }),
        // Verfahren / Prüfdauer / Prüfbedingungen / Temperatur / rel.
        // Feuchte all sit flush against each other — no blank line
        // anywhere in the run. Only after the last of them does a normal
        // gap resume, before "Gerätetechnik:".
        definitionTable(
          [
            ["Verfahren:", "nach DIN EN ISO 6270-2 CH:2018-04"],
            ["Prüfdauer:", `${cwtDurationCompact} ${formatDateDots(cwtBegin)} – ${formatDateDots(cwtEnd)}`],
          ],
          { labelWidthPx: 90 }
        ),
        bodyParagraph("Prüfbedingungen:", { flush: true }),
        definitionTable(
          [
            ["Temperatur:", "40° +/- 2 °C"],
            ["rel. Feuchte:", "nahe 100 % mit Betauung der Proben (>96%)"],
          ],
          { indentPx: 24, labelWidthPx: 100 }
        ),
        spacer(16),

        bodyParagraph("Gerätetechnik: Korrosionsprüfgerät SKBWF-C 1000 A-TR von Gebr. Liebisch GmbH Co. KG", { tight: true }),
        mixedParagraph([{ text: "Prüfteile: " }, { text: testObjectPart, bold: true }, { text: ` – ${quantity} Musterteile` }]),

        // Sollvorgaben is a label with THREE stacked value lines, same
        // tab-aligned label/value column as Verfahren/Prüfdauer above, with
        // a full blank-line gap between each value (rowGapPx: 16) instead
        // of the tight 2px list rhythm definitionTable normally uses.
        definitionTable(
          [
            ["Sollvorgaben:", "keine Blasenbildung"],
            [null, "keine Grundmetallkorrosion"],
            [null, "Gitterschnittprüfung nach DIN EN ISO 2409 Anforderung: Kennwert ≤ 1"],
          ],
          // Wider than the 90px used for Verfahren/Prüfdauer — gives
          // "Sollvorgaben:" real breathing room before its value starts;
          // every following row reserves this exact same label width via a
          // null label, so all three value lines land flush under "keine
          // Blasenbildung".
          { labelWidthPx: 140, rowGapPx: 16 }
        ),

        ...(constantClimateBox.length
          ? [
              heading(`Zustand nach ${cwtDurationCompact} Kondenswasserkonstantklima`, { size: pxHalfPt(12.5), underline: true }),
              ...constantClimateBox,
            ]
          : []),

        ...(crosscut2Box.length ? [heading("Gitterschnittprüfung:", { size: pxHalfPt(12.5), underline: true }), ...crosscut2Box] : []),

        resultsTable(
          `Ergebnis nach ${cwtDurationCompact} Kondenswasserkonstantklima nach DIN EN ISO 6270-2`,
          table2Rows,
          (row) => row.duration,
          [10, 10, 10, 9]
        ),
        spacer(16),

        new Paragraph({ spacing: { before: px(8), after: px(2) }, children: [run("Bewertung:", { bold: true })] }),
        bodyParagraph(
          evaluationSummary2 ||
            "Bei der Prüfung der Korrosionsbeständigkeit im 240h Kondenswasserkonstantklima erfüllt der Zustand hinsichtlich Blasengrad, Grundmetallkorrosion und Gitterschnittkennwert die Anforderungen nach Norm TL 227. Die Gitterschnittkennwerte liegen nach der Belastung bei 2x Gt0. Der Kondenswasserkonstantklimatest ist somit als bestanden zu bewerten."
        ),
      ]
    : [];

  const body = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: pxPt(1.5) * 8, color: "1A1A1A", space: pxPt(12) } },
      spacing: { before: px(28), after: px(36) },
      children: [run("Prüfbericht", { bold: true, size: pxHalfPt(16) })],
    }),

    infoTable,
    spacer(36),
    dateTable,

    spacer(40),
    ...(signatureRun ? [new Paragraph({ spacing: { after: px(12) }, children: [signatureRun] })] : []),
    bodyParagraph(subjectTask.createdBy || "—", { tight: true }),
    bodyParagraph("Leiter Qualitätsmanagement", { tight: true }),

    spacer(300),
    bodyParagraph("Anlagen", { tight: true }),
    // A plain static number, not a NUMPAGES field — see the footer's
    // identical reasoning above. This is the exact line the user reported
    // always reading "1 Seiten Protokoll" regardless of the real page
    // count: the field's cached value was already correct, but Word's own
    // (unreliable) recalculation on open was overriding it.
    new Paragraph({
      spacing: { after: px(4) },
      children: [run(String(pageCount || 1)), run(" Seiten Protokoll")],
    }),
    new Paragraph({
      spacing: { after: px(20) },
      children: [
        run(
          "Die Prüfleistungen beziehen sich ausschließlich auf den o. g. Prüfauftrag und auf die damit übergebenen Prüfstücke",
          { italics: true, size: pxHalfPt(10.5), color: "6B6B6B" }
        ),
      ],
    }),

    heading("Sachverhalt / Prüfaufgabe", { size: pxHalfPt(14), before: 8, pageBreakBefore: true }),
    bodyParagraph("Gemäß Beauftragung war an den übergebenen Musterteilen nachfolgende Prüfung vorzunehmen:"),
    sachverhaltTable,
    spacer(16),
    numberedTable,
    spacer(16),

    ...corrosionSection,
    ...condensationSection,
  ];

  const doc = new Document({
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: FONT_FAMILY } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(PAGE_WIDTH_MM),
              height: convertMillimetersToTwip(PAGE_HEIGHT_MM),
            },
            margin: {
              top: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
              header: 720,
              footer: 720,
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
