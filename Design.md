# Design

Visual conventions for the Osteks app. Two distinct "looks" coexist on purpose: the **app UI** (this app's own teal-accented interface) and the **Test Report document** (styled to read as a real printed Prüfbericht, not as app chrome) — called out separately below wherever they differ.

---

## Color & Theme

**No CSS custom properties/variables anywhere in the codebase** — every color is a literal hex value, repeated in each component's own `.css` file. A theme change is a find-and-replace across every file listed below, not a single edit. (See `MEMORY.md`'s theme-history notes for the full swap log if a past theme ever needs restoring.)

### Current theme: "light teal" (applied 2026-08-13)

| Role | Hex | Used for |
|---|---|---|
| Primary accent | `#14B8A6` | Active nav item text, primary buttons, focus borders, checked radio/checkbox accents |
| Accent hover | `#0F9C8C` | Hover state of the above |
| Light tint | `#E1F7F3` | Icon backgrounds, highlighted pill rows |
| Text-on-tint | `#0F8A7C` | Text sitting on the light tint background |
| Sidebar active row bg | `#D7F3EE` | Selected sidebar/submenu item |
| Sidebar hover row bg | `#EFFBF8` | Hovered sidebar/submenu item |
| Dropzone-dragging bg | `#D7F3EE` | Upload drop zone while a file is dragged over it |

Applied across: `App.css`, `components/Calculation/calculation.css`, `components/Upload/upload.css`, `components/Sidebar/Sidebar.css`, `components/OfferDetails/offerDetails.css`, `components/Extraction/extraction.css`, `components/common/customSelect.css`, `components/AllDocuments/allDocuments.css`.

Custom dropdowns (`common/CustomSelect.jsx`) exist specifically because a native `<select>` popup can't be restyled — its hover color always follows the OS accent color regardless of CSS. Any future theme change must also update `customSelect.css`'s hardcoded trigger/option colors, not just the files above.

### Neutrals

| Role | Hex |
|---|---|
| Page background | `#F3F5F9` |
| Body text | `#172033` |
| Card/panel background | `#FFFFFF` |

### Semantic status colors (not part of the theme — never swapped with it)

Used for Pass/Fail/Conditional assessments and similar status badges (`components/TestReport/testReport.css`):

| Status | Background | Text |
|---|---|---|
| Pass / Fulfilled | `#E7F8EE` | `#1FA056` (a second green pairing, `#16a34a`/`#15803d`, is used for a couple of other "OK" badges) |
| Fail | `#FDECEA` | `#B3261E` |
| Conditional | `#FEF3E2` | `#B45309` |

Green is the app's one recurring color-collision risk: the semantic "success" green sits close to the teal theme in hue — worth a second look if the two are ever hard to tell apart in the same view.

### The Test Report *document* is monochrome by design

Step 5's preview and the exported `.docx` intentionally ignore the app's teal theme entirely — it's meant to look like a real printed inspection report: white page, near-black body text (`#1A1A1A`), muted gray table borders (`#DDD`), gray letterhead banner (`#8A8A8A` → `#D4D4D4` gradient), and solid **black** borders specifically around photo boxes (`#1A1A1A`, heavier weight than the gray table rules) so they read as figures, not data tables.

---

## Fonts

Two separate font stacks, deliberately not unified:

| Context | Font stack | Why |
|---|---|---|
| **App UI** (everything except the Test Report document itself) | `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | Set once on `body` in `App.css`; every component inherits it |
| **Test Report document** — both the on-screen preview (`.doc-page` in `testReportPreview.css`) and the downloaded `.docx` (`FONT_FAMILY` in `buildTestReportDocx.js`) | **Arial** (preview stack: `Arial, "Helvetica Neue", Helvetica, sans-serif`) | Explicitly requested — the printed report should look like a document typed in Word with Arial, not the app's own Inter UI font |

The two `Arial` declarations (CSS `font-family` + the docx builder's `FONT_FAMILY` constant) are the only two places to touch if this ever changes again — everything else in that file/CSS references them rather than hardcoding the name a second time.

---

## Typography

### App UI scale

No formal type-scale system (no `h1`-`h6` convention, no rem-based scale) — sizes are chosen per component, but cluster into a consistent rhythm:

| Level | Size | Weight | Example |
|---|---|---|---|
| Page title | 17px | 700 | `.testreport-page-title` — the wizard's own header is the largest heading in the app UI; other pages don't go above card-title scale |
| Sidebar menu label | 15.5px | — | Top-level nav items |
| Card / section title | 13.5px | 700 | `.testreport-card-title`, `.testreport-section-title`, All Documents card headers |
| Body / table text | 10–12px | 400–600 | The dominant range across the app — this is a dense, data-table-style enterprise UI, not a marketing site |
| Small badges / status labels | 10–11.5px | 600 | Assessment badges, table header cells |

Font-weight usage across the app skews to **600 and 700** (labels, headers, buttons all read bold/semibold by default) — plain 400 weight is reserved for the smallest amount of body copy; there's no 300/light weight anywhere.

### Test Report document scale (both preview and `.docx`, kept numerically identical between the two)

| Element | Size |
|---|---|
| Document title ("Prüfbericht") | 16pt |
| `h2` (top-level section, e.g. "2. Kondenswasserkonstantklimatest") | 14pt |
| `h3` (subsection, e.g. "Anlieferungszustand", "Enthaftung…") | 13pt |
| `h4` (checkpoint heading, e.g. "Zustand nach 15 Zyklen…", underlined) | 12.5pt |
| **Body paragraphs — 10pt** (Word's own "10" font-size box) | 10pt |
| Table header / default cell text | 12pt |
| Results-table text | 11.5pt |
| Footer text | 10.5pt |
| Photo captions / d-value labels | 10pt, italic |

Line-height for body text is `1.55` (set once on `.doc-page`, not per element). The on-screen preview's body font-size (`13.2px`) is **not** a literal pt→px conversion — it's scaled to preserve the same visual proportion the previous 11pt/14.5px pairing had, so a change to the export's point size and a change to the preview's pixel size always move together rather than the two drifting to different apparent sizes on screen vs. paper. Every other document text size (headings, tables, footer) uses a simpler convention: the CSS pixel number and the docx point number are the same literal figure (e.g. `h2 { font-size: 14px }` in the preview pairs with `pxHalfPt(14)` — 14pt — in the docx builder) purely for the source code to stay easy to keep in sync, not because 14px on a screen and 14pt on paper are the same physical size.
