import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { FileText, Download, FileType2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getDocPreviewContent } from "./docPreviewContent";
import { buildDocxBlob } from "./buildDocx";
import { formatEUR } from "../Calculation/format";
import { useTranslation } from "../../i18n/LanguageContext";
import "./docPreview.css";

// ===========================================================================
// A4 PAGE GEOMETRY — must match the .dp-page / .dp-letterhead--small rules in
// docPreview.css exactly (794 x 1123px ≈ A4 at 96dpi, padding 78/72/90px).
// Used to figure out, from REAL measured content height, how many pages are
// needed and where each one breaks — see the pagination block below.
// ===========================================================================
const PAGE_HEIGHT = 1123;
const PAGE_PADDING_TOP = 78;
const PAGE_PADDING_BOTTOM = 90;
const PAGE_CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
// Small cushion against sub-pixel layout rounding — never fill a page down
// to the very last pixel of the budget, so nothing can spill over into the
// bottom padding by a hair's width.
const SAFETY_BUFFER = 3;

// Layout, spacing and field order match the reference "Angebot" PDF exactly.
// Most content is still static sample data from docPreviewContent.js.
// Projekt, the recipient address, and Angebot Nr. are wired to real Firma
// Information values (via the `firmaInfo` prop, shared across every image of
// the offer), falling back to the static sample whenever the corresponding
// field hasn't been filled in yet, so the preview never looks half-empty by
// default. The pricing/details block is different on purpose: it's driven
// entirely by `offerDetailsRowsList` — one row-array per uploaded image
// (already ordered and filtered to non-empty fields by OfferDetails), with
// no static fallback — a partially-filled Offer Details form shows partial
// rows here, not placeholder sample rows for the rest.
//
// PAGINATION: the document used to be two hardcoded `.dp-page` blocks (a
// fixed "page 1" / "page 2" split, with a manual page break baked in) — content
// that ran long just grew a page taller than real A4 instead of flowing onto
// a new sheet, which also meant the preview and the .docx download (which
// paginates for real, by Word's own layout engine) could show completely
// different page counts for the same offer. This has been replaced with real
// content-driven pagination: the whole letter is one ordered list of
// "blocks" (the `blocks` memo below), rendered once into an offscreen
// measuring pass to get each block's true rendered height, then bucketed
// into as many A4 pages as it actually takes — a continuation page gets the
// small letterhead (exactly like the old fixed "page 2" did) and its own
// page number, and there can be 1, 2, 3, or more pages depending on how much
// content there actually is. Nothing above 2 pages' worth of the sample
// content changes how it looks; it only kicks in once content is long enough
// to need a 3rd+ page, which the old fixed layout couldn't do at all.
const DocPreview = ({ firmaInfo = {}, offerDetailsRowsList = [[]], angebotsgueltigkeitDigits = "" }) => {
  const { t, language } = useTranslation();
  // Defaults to "Without Specification" on load — see the docpreview-spec-
  // toggle radios below.
  const [specMode, setSpecMode] = useState("without");
  const [downloading, setDownloading] = useState(false);
  const [pages, setPages] = useState([]);
  const surfaceRef = useRef(null);
  const measureRef = useRef(null);
  const continuationHeaderRef = useRef(null);
  const blockRefs = useRef([]);

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

  // Address is entered as one line per line of the address (a textarea, not
  // a single-line input, specifically so this split is possible) — falls
  // back to the static sample recipient block until something's typed.
  const recipientLines = firmaInfo.address?.trim()
    ? firmaInfo.address
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : RECIPIENT_LINES;

  const headingRows = [
    [HEADING_ROWS[0][0], firmaInfo.companyName?.trim() ? firmaInfo.companyName : HEADING_ROWS[0][1]],
    [HEADING_ROWS[1][0], firmaInfo.offerNumber?.trim() ? firmaInfo.offerNumber : HEADING_ROWS[1][1]],
  ];

  const dateLine = getTodayDateLine();

  // "Preisgültigkeit" isn't in the static TERMS_ROWS content anymore — its
  // date is Offer Details' own Angebotsgültigkeit field (today by default,
  // or whatever the user typed there) plus 3 months, live, never computed
  // independently of it. Appended here as one extra row, recomputed on
  // every render same as the letter's own date line above.
  const termsRows = [...TERMS_ROWS, [PRICE_VALIDITY_LABEL, getPriceValidityDateLine(angebotsgueltigkeitDigits)]];

  // The With/Without Specification toggle now only changes this one bold
  // paragraph — the Coating/Pre-treatment/etc. field list above is shown
  // unconditionally regardless of which radio is selected.
  const specNote = specMode === "with" ? WITH_SPEC_NOTE : WITHOUT_SPEC_NOTE;
  const page2Paragraphs = [specNote, ...PAGE2_BOLD_PARAGRAPHS];

  // These annotations exist ONLY here, in Document Preview / the downloaded
  // file — the live Offer Details form (OfferDetails.jsx) shows the same
  // fields plainly, with no suffix. Korrosionsschutztests/Gestellbaukosten
  // are one-time flat costs (not priced per part like the others), called
  // out on the LABEL side; Beschichtung/Maskierung/Verpackung/Gesamt are
  // genuinely per-piece prices, called out on the VALUE side; Jahresmenge
  // gets a plain piece-count unit appended the same way.
  const ONE_TIME_KEYS = ["preisKorrosionsschutztests", "gestellbaukosten"];
  const PER_PIECE_VALUE_KEYS = ["preisBeschichtung", "preisMaskierung", "preisVerpackung", "preisGesamt"];
  const withOneTimeLabel = (label) => `${label.replace(/:\s*$/, "")} (${t("docPreview.oneTimeSuffix")}):`;
  const withPerPieceValue = (value) => `${value} / ${t("docPreview.perPieceSuffix")}`;

  // Any "€" amount gets rounded to plain cents here — Offer Details itself
  // still shows full precision (e.g. Preis Beschichtung's 4dp, "2,2915 €",
  // for its own unit-economics purposes), but a customer-facing document
  // reads as a normal 2-decimal price ("2,29 €"), same as Preis Gesamt
  // already does. Parses the already German-formatted string (comma
  // decimal, period thousands) the row arrives with back to a number, then
  // re-formats with formatEUR (format.js) — same de-DE formatter every
  // other price in this app already goes through — so a large amount keeps
  // its thousands separator too ("1.234,57 €"), not just its decimals.
  const roundEuroValue = (value) => {
    const match = typeof value === "string" && value.match(/^(.*?)\s*€$/);
    if (!match) return value;
    const num = Number(match[1].replace(/\./g, "").replace(",", "."));
    return Number.isFinite(num) ? formatEUR(num) : value;
  };

  // Offer Details rows carry the field KEY (e.g. "preisBeschichtung"), not a
  // pre-translated label — translate to the current language's label right
  // here, at render/export time, so a saved offer always shows in whichever
  // language is currently selected rather than whatever was active when it
  // was saved. Flattened for the .docx export, which renders one label/
  // value table — a blank spacer row is inserted between images' groups
  // only when there is more than one (no "Document N:" label — just space),
  // so a single-image offer's export is unchanged.
  const translatedRows = (rows) =>
    rows.map(([key, value]) => {
      let label = t(`offerDetails.${key}`);
      let val = roundEuroValue(value);
      if (ONE_TIME_KEYS.includes(key)) label = withOneTimeLabel(label);
      if (PER_PIECE_VALUE_KEYS.includes(key)) val = withPerPieceValue(val);
      if (key === "jahresmenge") val = `${val} ${t("docPreview.perPieceSuffix")}`;
      if (key === "schichtdicke" && !/[µμ]m/i.test(val)) val = `${val} µm`;
      return [label, val];
    });
  const flatOfferDetailsRows = (() => {
    if (offerDetailsRowsList.length <= 1) return translatedRows(offerDetailsRowsList[0] ?? []);
    // Same "only space after the first group that actually has rows" logic
    // as the `blocks` pricing entries above — an empty leading group (e.g.
    // image 1 has no offer details filled in yet) must not produce a blank
    // spacer row before the first real one.
    const out = [];
    let seenFirstGroup = false;
    offerDetailsRowsList.forEach((rows) => {
      if (rows.length === 0) return;
      if (seenFirstGroup) out.push(["", ""]);
      seenFirstGroup = true;
      out.push(...translatedRows(rows));
    });
    return out;
  })();

  // ===================== BLOCK LIST (single source of flow) =====================
  // Every visual unit of the letter, in reading order, as one flat array.
  // Each block is measured once (see the layout effect below) and then
  // bucketed onto pages by real height — nothing here decides which page a
  // block lands on, that's computed from the measurement.
  const blocks = useMemo(() => {
    const list = [
      {
        key: "letterhead",
        // Absolutely positioned (see .dp-letterhead) — contributes ~0 to
        // flow height by design, always ends up on page 1 since it's first.
        node: (
          <div className="dp-letterhead">
            <div className="dp-letterhead-company">{LETTERHEAD.company}</div>
            <div className="dp-letterhead-sub">{LETTERHEAD.sub}</div>
          </div>
        ),
      },
      { key: "return-address", node: <div className="dp-return-address">{RETURN_ADDRESS}</div> },
      {
        key: "recipient",
        node: (
          <div className="dp-recipient">
            {recipientLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        ),
      },
      {
        key: "contact",
        node: (
          <div className="dp-contact">
            {CONTACT_ROWS.map(([label, value]) => (
              <div key={label}>
                {label}
                <span>{value}</span>
              </div>
            ))}
          </div>
        ),
      },
      { key: "date", node: <div className="dp-date">{dateLine}</div> },
      {
        key: "heading-rows",
        node: (
          <>
            {headingRows.map(([label, value]) => (
              <div className="dp-heading-row" key={label}>
                <span className="dp-heading-label">{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </>
        ),
      },
      { key: "salutation", node: <p className="dp-salutation">{SALUTATION}</p> },
      {
        key: "intro",
        node: (
          <p className="dp-para">
            {INTRO_LINES.map((line, i) => (
              <React.Fragment key={line}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </p>
        ),
      },
      {
        // Always shown now — no longer conditional on specMode.
        key: "spec-fields",
        node: (
          <div className="dp-fieldlist">
            {SPEC_FIELD_ROWS.map(([label, lines]) => (
              <div className="dp-field-row" key={label}>
                <span className="dp-field-label">{label}</span>
                <span className="dp-field-value">
                  {lines.map((line, i) => (
                    <React.Fragment key={line}>
                      {i > 0 && <br />}
                      {line}
                    </React.Fragment>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ),
      },
    ];

    // One block per uploaded image's pricing group — kept atomic (never
    // split mid-table across a page break), with a plain spacer block
    // between groups instead of a "Document 1/2/3" label.
    let seenFirstGroup = false;
    offerDetailsRowsList.forEach((rows, i) => {
      if (rows.length === 0) return;
      if (seenFirstGroup) {
        list.push({ key: `spacer-${i}`, node: <div className="dp-group-spacer" /> });
      }
      seenFirstGroup = true;
      // Same translatedRows() the .docx export builds flatOfferDetailsRows
      // from (see above) — labels/values/annotations ((one-time), "/ pc",
      // µm, Stk.) are computed in exactly one place now, so the on-screen
      // preview and the download can never show these rows differently.
      list.push({
        key: `pricing-${i}`,
        node: (
          <div className="dp-pricing-block">
            {translatedRows(rows).map(([label, value], rowIndex) => (
              <div className="dp-pricing-row" key={rowIndex}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        ),
      });
    });

    list.push({ key: "disclaimer", node: <p className="dp-para dp-bold">{PAGE1_DISCLAIMER}</p> });

    page2Paragraphs.forEach((text, i) => {
      list.push({ key: `p2-${i}`, node: <p className="dp-para dp-bold">{text}</p> });
    });

    list.push({
      key: "terms",
      node: (
        <div className="dp-fieldlist dp-fieldlist--terms">
          {termsRows.map(([label, value]) => (
            <div className="dp-field-row" key={label}>
              <span className="dp-field-label">{label}</span>
              <span className="dp-field-value">{value}</span>
            </div>
          ))}
        </div>
      ),
    });

    list.push({ key: "closing", node: <p className="dp-para">{CLOSING_LINE}</p> });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, specMode, JSON.stringify(recipientLines), JSON.stringify(headingRows), dateLine, JSON.stringify(offerDetailsRowsList), angebotsgueltigkeitDigits]);

  const continuationHeader = (
    <div className="dp-letterhead dp-letterhead--small">
      <div className="dp-letterhead-company dp-letterhead-company--small">{LETTERHEAD.company}</div>
      <div className="dp-letterhead-sub">{LETTERHEAD.sub}</div>
    </div>
  );

  // Measure every block's real rendered height (via an offscreen pass using
  // the exact same page width/padding/typography), then bucket them into as
  // many A4 pages as actually needed. Re-runs whenever the block list's
  // content changes.
  useLayoutEffect(() => {
    if (!measureRef.current) return;

    // Drop any stale trailing entries from a previous, longer block list
    // (e.g. going from 3 uploaded images' worth of rows down to 1).
    blockRefs.current.length = blocks.length;

    const containerTop = measureRef.current.getBoundingClientRect().top;
    const tops = blockRefs.current.map((el) => (el ? el.getBoundingClientRect().top - containerTop : 0));
    const bottoms = blockRefs.current.map((el) => (el ? el.getBoundingClientRect().bottom - containerTop : 0));
    const heights = blocks.map((_, i) =>
      i < blocks.length - 1 ? tops[i + 1] - tops[i] : bottoms[i] - tops[i]
    );

    const continuationHeaderHeight = continuationHeaderRef.current
      ? continuationHeaderRef.current.getBoundingClientRect().height
      : 0;

    const firstPageBudget = PAGE_CONTENT_HEIGHT - SAFETY_BUFFER;
    const laterPageBudget = PAGE_CONTENT_HEIGHT - SAFETY_BUFFER - continuationHeaderHeight;

    const computed = [];
    let current = [];
    let used = 0;
    let budget = firstPageBudget;

    blocks.forEach((block, i) => {
      const h = Math.max(0, heights[i]);
      if (current.length > 0 && used + h > budget) {
        computed.push(current);
        current = [];
        used = 0;
        budget = laterPageBudget;
      }
      current.push(block);
      used += h;
    });
    if (current.length > 0) computed.push(current);

    // Always apply the freshly bucketed pages — this effect only re-runs
    // when `blocks` itself changed (that's the dependency array below), so
    // by the time we're here there's always a real content change to show.
    // A key-based "did anything actually change" shortcut used to live
    // here, comparing only each block's `key` string between the old and
    // new pages — but a block's key (e.g. "pricing-0", stable per image
    // slot) doesn't change just because the VALUE inside it does, so
    // correcting a number without adding/removing a field looked
    // key-identical and got silently discarded, leaving the stale old
    // pages on screen — exactly the "preview doesn't match what I just
    // typed" bug this was causing. Just take the new computation.
    setPages(computed);
  }, [blocks]);

  // PDF export rasterizes the actual rendered pages — a PDF is expected to
  // be a faithful visual snapshot, so a screenshot-per-page is the right
  // tool here and guarantees pixel-for-pixel match with the preview. Works
  // for however many `.dp-page` elements the pagination above produced.
  // JPEG at high quality instead of PNG — lossless PNG of a full
  // anti-aliased text page runs to 10+ MB per page; JPEG compresses the
  // mostly-white page down to a few hundred KB with no visible quality loss.
  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const pageEls = surfaceRef.current.querySelectorAll(".dp-page");
      const pdf = new jsPDF({ unit: "px", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();

      let index = 0;
      for (const pageEl of pageEls) {
        // eslint-disable-next-line no-await-in-loop
        const canvas = await html2canvas(pageEl, { scale: 2, backgroundColor: "#ffffff" });
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        if (index > 0) pdf.addPage();
        pdf.addImage(dataUrl, "JPEG", 0, 0, pdfWidth, pdfHeight);
        index += 1;
      }

      pdf.save(t("docPreview.filenamePdf"));
    } finally {
      setDownloading(false);
    }
  };

  // Doc export builds a real .docx binary (via the `docx` library), not a
  // picture of the page or an HTML approximation — the header/footer are
  // genuine OOXML section headers, so Word repeats them on every page by
  // construction, and the file opens as actual editable text. Word paginates
  // this by its own real layout engine (no manual page break baked in
  // anymore — see buildDocx.js), so it lands on the same page count as this
  // preview for the same content.
  const handleDownloadDoc = async () => {
    const blob = await buildDocxBlob(
      specMode,
      { recipientLines, headingRows, offerDetailsRows: flatOfferDetailsRows, angebotsgueltigkeitDigits },
      language
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = t("docPreview.filenameDocx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="docpreview-card">
      <div className="docpreview-card-header">
        <span className="docpreview-card-icon">
          <FileText size={16} />
        </span>
        <h3 className="docpreview-card-title">{t("docPreview.title")}</h3>

        <div className="docpreview-actions">
          <button type="button" className="docpreview-btn" onClick={handleDownloadDoc}>
            <FileType2 size={14} />
            {t("docPreview.downloadAsDoc")}
          </button>

          <button
            type="button"
            className="docpreview-btn docpreview-btn--solid"
            onClick={handleDownloadPdf}
            disabled={downloading}
          >
            <Download size={14} />
            {t("docPreview.downloadAsPdf")}
          </button>
        </div>
      </div>

      <div className="docpreview-spec-toggle">
        <label className="docpreview-radio">
          <input
            type="radio"
            name="docpreview-spec"
            checked={specMode === "with"}
            onChange={() => setSpecMode("with")}
          />
          {t("docPreview.withSpecification")}
        </label>

        <label className="docpreview-radio">
          <input
            type="radio"
            name="docpreview-spec"
            checked={specMode === "without"}
            onChange={() => setSpecMode("without")}
          />
          {t("docPreview.withoutSpecification")}
        </label>
      </div>

      {/* Offscreen measuring pass — same page width/padding/typography as a
          real .dp-page, rendered as one continuous flow so each block's
          true height (including collapsed margins) can be read back via
          getBoundingClientRect(). Never shown to the user. */}
      <div className="dp-page dp-page--measure" ref={measureRef} aria-hidden="true">
        <div className="dp-letterhead-small-measure" ref={continuationHeaderRef}>
          {continuationHeader}
        </div>
        {blocks.map((block, i) => (
          <div key={block.key} ref={(el) => (blockRefs.current[i] = el)}>
            {block.node}
          </div>
        ))}
      </div>

      <div className="docpreview-surface" ref={surfaceRef}>
        {pages.map((pageBlocks, pageIndex) => (
          <div className="dp-page" key={pageBlocks.map((b) => b.key).join("-") || pageIndex}>
            {pageIndex > 0 && continuationHeader}
            {pageBlocks.map((block) => (
              <React.Fragment key={block.key}>{block.node}</React.Fragment>
            ))}
            <div className="dp-page-number">{pageIndex + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocPreview;
