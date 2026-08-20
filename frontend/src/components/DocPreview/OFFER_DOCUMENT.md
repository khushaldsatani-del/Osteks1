# Offer Document (Angebot) — Preview & Download

Reference design notes for the "Document Preview" section (rendered below Offer Details on the main page). Covers what it is, how it's built, and every Word-export gotcha discovered while building it — so the next change doesn't have to re-learn these the hard way.

## What it does

Shows a live, on-screen replica of OSTEKS' standard "Angebot" (offer) letter — matching the layout, spacing, and structure of a real reference PDF (`Angebot 32258-00099.pdf`) — and lets the user download it as:
- **PDF** — a pixel-perfect visual snapshot of what's on screen.
- **Doc** (`.docx`) — a real, editable Word document (genuine OOXML, not a picture), so the user can open it and edit it after downloading.

A "With Specification" / "Without Specification" radio toggle shows or hides the coating-specification block (Beschichtung / Vorbehandlung / Anlieferzustand / Anteilige Rüstkosten / Ausschussquote) on page 1. It does **not** affect page 2's delivery-terms block, which is a separate thing.

## Files

| File | Role |
|---|---|
| `docPreviewContent.js` | Single source of truth for the document's text content. Both the on-screen preview and the Word export read from these same exported arrays/values, so they can't drift apart. |
| `DocPreview.jsx` | The component: renders the on-screen A4-page preview from `docPreviewContent.js`, the spec toggle, the two download buttons, and the PDF/Doc export handlers. |
| `docPreview.css` | On-screen preview styling only (`.dp-*` classes) — the "paper sheet" look, fonts, spacing. Has no effect on the downloaded files. |
| `buildDocx.js` | Builds a real `.docx` binary (via the [`docx`](https://www.npmjs.com/package/docx) npm library) for the Doc download. Everything Word-specific lives here. Replaced the old `buildWordHtml.js` (HTML-as-`.doc` trick) — see "Doc download" below for why. |

## Content model (`docPreviewContent.js`)

Currently **static sample data** matching the reference PDF — `LETTERHEAD`, `RETURN_ADDRESS`, `RECIPIENT_LINES`, `CONTACT_ROWS`, `HEADING_ROWS` (Projekt/Angebot Nr.), `SALUTATION`, `INTRO_LINES`, `SPEC_FIELD_ROWS`, `PAGE1_DISCLAIMER`, `PAGE2_BOLD_PARAGRAPHS`, `TERMS_ROWS`, `CLOSING_LINE`.

The pricing/details block (Teilebezeichnung/Zeichnungsnummer/.../Prüfungen) used to live here as a static `PRICING_ROWS` export — it's been removed. That block is now driven entirely by `offerDetailsRows`, a prop threaded from `OfferDetails.jsx` (see "Offer Details → pricing block" below); it has **no static fallback** by design.

The date line used to be a static `DATE_LINE` export too — replaced with `getTodayDateLine()`, a function (not a constant) that formats the current date in German long form (`Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" })`, e.g. "14. August 2026") live on every render/export, so the letter always shows the day it was actually generated.

**Wired to live data so far**: recipient/heading rows (via `firmaInfo`), the pricing/details block (via `offerDetailsRows`), and the date line (always live, never sample data — see above). **Not yet done, deliberately deferred**: `CONTACT_ROWS`, `SALUTATION`, `INTRO_LINES`, `SPEC_FIELD_ROWS`, `PAGE1_DISCLAIMER`, `PAGE2_BOLD_PARAGRAPHS`, `TERMS_ROWS`, `CLOSING_LINE` are all still hardcoded sample text, as are `LETTERHEAD`/`RETURN_ADDRESS` (OSTEKS' own details — unlikely to ever need to be dynamic). When any of these get wired up, they should become derived from props/state rather than static constants — the two consumers (`DocPreview.jsx` and `buildDocx.js`) don't need to change their own logic, just what they're fed.

## Offer Details → pricing block

`OfferDetails.jsx` computes its own ordered, filtered `[label, value]` rows (one `useEffect` keyed on its `values`/`syncedFields`, iterating its own `FIELDS` array in the exact order they're defined, plus `Prüfungen` appended by hand since it's a separate textarea not in `FIELDS`) and reports them upward via an `onOfferDetailsChange` callback. `Documents.jsx` holds the result in `offerDetailsRows` state and passes it to both `OfferDetails` (implicitly, via the callback) and `DocPreview`/`buildDocxBlob` (as a prop/override).

Two deliberate behaviors, both per explicit request:
- **Only fields with an actual value produce a row** — a half-filled Offer Details form shows a half-filled block here, not blank/placeholder rows for the rest. If nothing is filled in, the whole block (heading included) is omitted from both the preview and the download.
- **`Notes` is excluded on purpose** — it's a free-text scratch field for internal reference, never meant to appear in the customer-facing document. (`Prüfungen` is a *different* field and is included.)

### Where Offer Details' own values come from

Three of `OfferDetails.jsx`'s fields (`teilebezeichnung`/`zeichnungsnummer`/`lackiervorschrift` — Teilebezeichnung/Zeichnungsnummer/Lackiervorschrift) don't have any other editable source elsewhere in the app, unlike `schichtdicke`/`jahresmenge`/`preisBeschichtung`/`preisMaskierung` (which mirror Calculation and are read-only `synced` fields). Instead they auto-fill from the AI drawing extraction, via `src/components/Calculation/extractionParser.js` — a util file that lives outside this folder (it's shared by Calculation too) but is upstream of everything documented here:

- `parseOfferDetailsFields(summary)` reads the raw extraction text (`Label: value` lines — see `backend/prompts/extractionPrompt.js` for the exact shape, which differs for single-part vs. assembly drawings) and maps **Part Name → Teilebezeichnung**, **Part Number → Zeichnungsnummer**, **Surface Treatment → Lackiervorschrift**, skipping any line whose value is literally "Not specified on drawing". `Documents.jsx` computes this via `useMemo` off `extraction.summary` and passes it to `OfferDetails` as `extractedFields`.
- `OfferDetails.jsx` merges `extractedFields` into its own local state on change (`useEffect`), but — unlike the `synced` fields — leaves the inputs fully editable afterward: extraction only supplies the *starting* value, so a wrong AI read can still be corrected by hand before it reaches the document.
- The sibling function `parseExtractionSummary(summary)` (same file) feeds Calculation's own Weight / Coating Thickness / Spec. Gewicht Stahl fields instead — unrelated to this document directly, but worth knowing it exists if a future change needs to extend what the AI extraction can auto-fill.

## On-screen preview

- Each page is a `.dp-page` div sized to A4 at 96dpi (794×1123px), stacked in a scrollable gray "desk" (`.docpreview-surface`) — like a print-preview pane.
- Font: `Calibri, "Segoe UI", Candara, Arial, sans-serif`. This is a **best-effort visual match**, not a confirmed exact value — the reference PDF's embedded font metadata was never available (only its extracted text and a rendered page image were), so if the exact font/point size is known (e.g. from Acrobat's document properties), it should be corrected here.
- Recipient address block, then the contact block (Telefon/Telefax/E-Mail/Internet) **stacked after it** (not side-by-side) and right-aligned, with tight line spacing. This was iterated on per explicit feedback — the original layout (matching the literal reference PDF) had them side-by-side; the user asked for the current stacked/right-aligned arrangement instead. **Keep the on-screen preview and the Word export's contact-block layout in sync** — they were deliberately unified after initially drifting apart.

## PDF download

`handleDownloadPdf` in `DocPreview.jsx`:
1. `html2canvas` rasterizes each rendered `.dp-page` element (`scale: 2` for crispness).
2. Exported as **JPEG at 0.92 quality**, not PNG — a lossless PNG of a full anti-aliased text page runs 10+ MB *per page*; JPEG compresses the mostly-white page down to a few hundred KB with no visible quality loss.
3. Each page image is embedded into a `jsPDF` document sized to A4, one page per image.

This is a straightforward screenshot-to-PDF pipeline — a PDF is expected to be a faithful visual snapshot, so rasterizing the real DOM is the right tool here (unlike the Doc export, see below).

## Doc download — history and current approach

`handleDownloadDoc` calls `buildDocxBlob(specMode, { recipientLines, headingRows, offerDetailsRows })` (async — `Packer.toBlob` returns a Promise) and downloads the result directly as `Angebot.docx`. `buildDocx.js` uses the `docx` npm library to construct genuine OOXML: real `Paragraph`/`Table`/`Header`/`Footer` objects, packed into an actual `.docx` zip. No HTML is involved anymore.

### Why this replaced the HTML-as-`.doc` trick
The original approach saved a `Blob([...html], { type: "application/msword" })` with a `.doc` extension — Word's HTML/MHTML import engine opens such a file as a real, editable document. This is a well-documented, standard technique, and a long series of fixes (flexbox → tables, `mso-margin-*-alt` for spacing, `mso-element:header/footer` for the repeating header/footer, the `{ PAGE }` field, `ProgId: Word.Document` + `w:WordDocument` markers, per-section header ids) got every *individual* piece working in isolation.

What could never be made reliable, across several rounds of real-Word screenshots from the user: **the header/footer repeating on every page of a multi-page document.** Attempts included a single section with one header id, two `@page` sections sharing one header id, and two sections each with their own header id — each produced a different failure (missing entirely, missing on page 2 only, or duplicated onto page 1). The HTML/mso-element route is Word's own *approximation* format for round-tripping through a browser-rendered page; it does not carry the same structural guarantees as a real OOXML section.

A real `.docx` file doesn't have this problem by construction: a section's `headerReference`/`footerReference` is defined exactly once in `document.xml`, and Word repeats it on every physical page of that section — this is that same mechanism every ordinary multi-page Word letter already relies on, not a special trick. Switching to the `docx` library (which generates that same real XML) turns "make Word repeat the header" from something to painstakingly reverse-engineer into something the file format does automatically. Verified by unzipping a generated `.docx` and confirming exactly one `header1.xml`/`footer1.xml`, referenced once from the single `sectPr` in `document.xml`.

### Structure of `buildDocx.js`
- `run()` / `linesParagraph()` — build `TextRun`/`Paragraph`s; multi-line content (e.g. the recipient address block) uses one `Paragraph` with `TextRun({ break: 1 })` between lines, not separate paragraphs, so there's no extra paragraph spacing.
- `labelValueTable()` — a borderless two-column `Table` for label/value rows (heading, spec fields, pricing/details, terms), mirroring the old HTML version's layout.
- The contact block (Telefon/Telefax/E-Mail/Internet) is right-aligned `Paragraph`s, one per row — simpler than the old tab-stop approach since there's no `<table align>` float bug to work around in real OOXML.
- Page 2 starts via `pageBreakBefore: true` on its first paragraph — same section as page 1, so the header/footer above keeps applying automatically.
- Page geometry (`properties.page.size`/`margin`) matches the old `@page Section1` values: A4, body margin `2.4cm 1.9cm 2.2cm 1.9cm`, header margin `1.1cm`, footer margin `1cm`.
- Footer page number uses `PageNumber.CURRENT` inside a `TextRun`'s `children` — a genuine auto-updating field, not static text.
- Font: `FONT_FAMILY = "Calibri"`, set both as the document's default style (`styles.default.document.run.font`) *and* explicitly on every individual `TextRun` (including inside the header/footer) — belt-and-suspenders, since relying on style inheritance alone left some runs rendering in Word's fallback font in practice. Header text sizes: "OSTEKS GMBH" at 20pt, the subtitle at 8pt — sizes are in half-points in `docx` (`halfPt()` converts pt → half-points; `BODY_SIZE = 21` is 10.5pt for everything else).

### Gotcha: table column widths need `columnWidths`, not just per-cell `width`
Setting `width` on each `TableCell` is **not enough** to size a table's columns — without also passing a `columnWidths` array (and `layout: TableLayoutType.FIXED`) on the `Table` itself, Word collapses the OOXML `<w:tblGrid>` to a placeholder width and the value column shrinks far below what was intended. In practice this wrapped a long value (Anlieferzustand, in the spec-fields table) into 11+ lines instead of a handful, pushing the whole letter from 2 pages to 3. Fixed by always passing both: `columnWidths: [labelWidthTwips, valueWidthTwips]` alongside each cell's own `width`. `CONTENT_WIDTH_TWIPS` (page width minus left/right margins, computed once via `convertMillimetersToTwip`) is the single source of truth every table's total/value-column width is derived from — verified structurally by unzipping a generated `.docx` and checking `<w:gridCol w:w="...">` in `document.xml` actually reflects the intended widths, not a `100` placeholder.

## Known limitations

- **No real Microsoft Word available during development.** The `.docx` output was verified structurally (unzipped and inspected the generated XML — correct single header/footer reference, correct page-break placement, correct `<w:gridCol>` widths) and via `Packer.toBlob` running without errors, but real-Word visual confirmation still depends on the user's own testing/screenshots.
- Wired to live data: Projekt / recipient address / Angebot Nr. (`firmaInfo` → `overrides.recipientLines`/`overrides.headingRows`, falls back to static sample when empty), the pricing/details block (`offerDetailsRows`, no fallback — see above), and the date line (always live, never sample data). Everything else (contact info, salutation, intro lines, spec-field text, disclaimers, terms, closing line, letterhead/return address) is still static sample content — see "Content model" above for the exact list.
- Everything happens client-side in the browser (`html2canvas`, `jsPDF`, and the `docx` library's `Packer.toBlob`) — no backend involvement in either export.
