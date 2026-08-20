# Project Memory — Osteks Coating Cost Calculator

Read this first in a new chat to pick up where things left off. This is a project handoff doc, not a design spec — for deep detail on a specific feature, follow the links to the dedicated docs.

## What this is

An internal tool for OSTEKS GmbH (coating/surface-treatment company) that:
1. Calculates coating costs from part weight/thickness/material/quantity, following formulas verified against a company spec PDF.
2. Lets a user upload an engineering drawing (PDF/PNG/JPG/TIFF), sends it to a backend that uses Gemini vision AI to extract manufacturing info (material, thickness, weight, coating spec, etc.) into a text summary, and optionally attach a related email (`.eml`/Outlook `.msg`) that is **stored and linked, never AI-processed** — see "Documents/email persistence" below.
3. Renders a live "Angebot" (offer letter) preview matching the company's real quote-letter format, downloadable as PDF or an editable Word `.docx`.

Not a git repository — there's no commit history to check; this file plus code comments are the record of what happened and why.

## How to run it

**Frontend** (`frontend/` — split out from the project root 2026-08-20 specifically so `backend/` and `frontend/` can each be deployed independently, e.g. `frontend/` to Vercel):
```
cd frontend
npm install
npm run dev
```
→ `http://localhost:5173`

**Backend** (drawing extraction + all persistence — required for anything to survive a page refresh; the calculator UI itself still works without it, just non-persistently). Python (FastAPI) — was Node/Express originally, ported to Python in full (see `backend/README.md`'s "Notes on the Python port" for what changed and how it was verified):
```
cd backend
python -m venv .venv
.venv\Scripts\activate      (Windows)  —  or  source .venv/bin/activate  (macOS/Linux)
pip install -r requirements.txt
copy .env.example .env
```
Then fill in `.env`'s `GEMINI_API_KEY` (https://aistudio.google.com/apikey) and `DATABASE_URL` (a Postgres connection string — currently a Neon project; tables are auto-created on startup). Currently configured Gemini model: `gemini-flash-latest` (an alias Google keeps pointed at their current recommended flash model — deliberately not pinned to a specific version, since `gemini-2.5-flash` got sunset for new accounts mid-project and broke things once already).
```
python main.py
```
→ `http://localhost:5001`. Frontend calls it automatically; if it's not running, extraction/persistence just show an error (the calculator itself still works, un-persisted).

## Deployment

Plan: `frontend/` → Vercel (root directory `frontend`, build command `npm run build`, output `dist`, framework preset Vite — no other config needed, it's a static SPA). `backend/` needs a host that runs a persistent process (Vercel doesn't run long-lived Python/uvicorn servers) — Render/Railway/Fly.io are the candidates, not yet chosen/deployed as of this writing. Postgres is already cloud-hosted on Neon, so no DB migration needed either way.

Once the backend has a real deployed URL, set `VITE_BACKEND_URL` as an environment variable in the Vercel project (not a `.env` file — Vercel builds don't read one) to that URL; `frontend/src/config.js` reads it, defaulting to `http://localhost:5001` when unset. Also update `backend/.env`'s `ALLOWED_ORIGINS` (currently unset → wildcard `*`) to the real Vercel domain once known, tightening CORS instead of leaving it wide open in production.

An earlier temporary Cloudflare "quick tunnel" setup (for a same-day client demo before this Vercel plan existed) has been fully torn down — no lingering tunnel processes, and the `vite.config.js` `allowedHosts` override that setup needed was reverted.

## Architecture

- **Frontend**: React 19 + Vite 8, plain CSS (no framework/Tailwind), no state library (component state + prop drilling / lifted state in `Documents.jsx`). `frontend/src/config.js` exports `BACKEND_URL`, shared by every component that talks to the backend.
- **Backend**: Python (FastAPI) in `backend/`. Gemini vision API for drawing extraction (`/api/extract`, unchanged since the Python port). Postgres (Neon) via `asyncpg` for persistence — `documents` (one row per uploaded drawing, created right after extraction succeeds, updated by Calculation's Save with pricing/offer/calculation data) and `emails`/`email_attachments` (an optional `.eml`/Outlook-`.msg` file linked 1:1 to a document — **stored and parsed for display only, never sent to Gemini or any AI**; see `backend/README.md`'s "Business rule" section). Client-side only for document export (no server involvement in PDF/Doc generation — `html2canvas` + `jsPDF` in the browser).

## Documents/email persistence (added 2026-08-19)

Every "All Documents" row, and the workspace's small "Uploaded Files" widget, is now backed by the `documents` table — `App.jsx`'s `documentRecords` is fetched fresh from `GET /api/documents` (via `refreshDocuments()`, called after every create/update/status-change/delete) rather than held as local-only state. A document is created the moment `/api/extract` succeeds (`Documents.jsx`'s `handleExtractionResult`), *not* when Calculation's Save is clicked — Save only `PATCH`es that same row with pricing/offer/calculation data. This is why the All Documents row can appear before Save is ever clicked.

Email upload is a second, independent control (`frontend/src/components/Upload/EmailAttach.jsx`, next to Upload File in the workspace) — disabled until a document exists, since an email can only be linked to an already-created one. It posts straight to `POST /api/emails/upload`; nothing about the Gemini extraction path changed. The All Documents Mail column (already existed, was always `"—"`) now renders `✉ {subject}` when `mailEmailId` is present and opens `EmailDetailsModal.jsx` (From/To/CC/Date/Subject/Body/Attachments, each downloadable) on click — see `backend/README.md`'s Endpoints section for the full email API.

## Page structure (top to bottom in `frontend/src/pages/Documents.jsx`)

1. **Upload File** / **Uploaded Files** (`frontend/src/components/Upload/`) — drag-drop single-file upload, triggering backend AI extraction. Directly below: **Attach Email (optional)** (`EmailAttach.jsx`) — storage-only, see above.
2. **Extracted Drawing Details** (`frontend/src/components/Extraction/ExtractionPreview.jsx`) — shows the AI's text summary of the uploaded drawing. Marked "temporary" in comments — was a quick scaffold, not deeply polished.
3. **Calculation** (`frontend/src/components/Calculation/`) — the core cost-calculation UI: Firma Information, Extracted Details, Revenue Metrics, Pricing Analysis & Machine Loading, For Information. See "Calculation engine" below.
4. **Offer Details** (`frontend/src/components/OfferDetails/`) — a secondary form (Teilebezeichnung, Zeichnungsnummer, etc.) with some fields auto-mirrored from Calculation (Schichtdicke, Jahresmenge, Preis Beschichtung, Preis Maskierung — read-only, synced via `onSyncOfferFields` callback prop chain).
5. **Document Preview** (`frontend/src/components/DocPreview/`) — the offer-letter preview + PDF/Doc download. **Full design doc**: `frontend/src/components/DocPreview/OFFER_DOCUMENT.md` — read that before touching this feature, it documents ~8 hard-won Word-export gotchas.

Plus `frontend/src/components/Sidebar/` (nav) and `frontend/src/components/common/CustomSelect.jsx` (a custom-built dropdown — native `<select>` popups can't be restyled with CSS, so Density/Beizen/Gußteil in Extracted Details use this instead; actively used, not dead code).

## Calculation engine (`frontend/src/components/Calculation/`)

- `calculationEngine.js` — pure functions, formulas cross-checked against a spec PDF ("Final Documentation for calculation.pdf" — no longer in this repo, was a one-time reference during development).
- `Calculation.jsx` — owns most of the app's numeric state. Key pattern used throughout: **natural vs. override**. Most Pricing Analysis fields (`AUTO_SYNC_FIELDS`) auto-follow their calculated value until the user types into them directly (tracked via `useRef` touched-sets, not React state, to avoid re-render loops). Clearing a field back to empty reverts it to auto-follow — but only on blur, not on every keystroke, so the field can go visibly empty while the user is actively editing.
- All numeric inputs are `type="text" inputMode="decimal"` with a manual sanitizer (`format.js`'s `cleanNumericInput`), not native `type="number"` — native number inputs had a confirmed backspace bug where clearing didn't always work.
- Indian-numbering-system live formatting (`formatIndianDigits`/`formatIndianLive` in `format.js`) on Weight, Surface Area [mm²], and Quantity.
- "Gewicht pro Warenträger in kg" turns light red when > 695kg (hardcoded threshold in `PricingAnalysis.jsx`).

## Theme

Current: **"light teal"**, primary accent `#14B8A6`. Full color history (5 theme iterations, with reasoning for each swap) lives in Claude's own memory system, not this repo — ask a new session to check its memory for `theme-history-osteks` if you need the palette details. **No file backups exist anymore** (a `theme-backups/` folder used to hold them; deleted 2026-08-13 per explicit request) — reverting to an old theme now means manually reapplying hex values from that memory record, not copying files back.

## Known gaps / not yet done

- **Document Preview content is mostly static sample data** (matching a real reference "Angebot 32258-00099.pdf" the user provided) — only Projekt / recipient address / Angebot Nr. are wired to live Firma Information values so far (via `firmaInfo` prop in `Documents.jsx` → `DocPreview.jsx`), falling back to the sample when empty. Wiring the rest (pricing, spec fields, etc.) to real Calculation/Offer Details/Extracted Details values is the likely "next step" — see `docPreviewContent.js` in the DocPreview folder for the data shape that needs to become dynamic.
- Extraction Preview section is explicitly commented as temporary/placeholder styling.
- No automated test suite exists (no `npm test`). All verification during development was manual, via Playwright-driven browser checks in a scratch directory (not part of this repo).
- **The Doc export is now a real `.docx` file** (`buildDocx.js`, using the `docx` npm library), not HTML-pretending-to-be-`.doc`. The original HTML/`mso-element` approach (documented in full in `OFFER_DOCUMENT.md`'s history section) got every individual Word-HTML quirk working but could never be made to reliably repeat the header/footer across multiple pages, despite several rounds of real-Word feedback from the user — a real OOXML section header, generated by an actual docx-writing library, doesn't have that problem by construction. It was still never opened in real Microsoft Word during development (no Word in the dev environment) — verification was structural (unzipping the generated `.docx` and inspecting `document.xml`/`header1.xml`/`footer1.xml`). If new issues show up in real Word, check `OFFER_DOCUMENT.md` first.

## Conventions worth knowing

- No comments explaining *what* code does — only *why*, when non-obvious (a gotcha, a workaround, a constraint). Match that style in new code.
- CSS files use one-declaration-per-line with blank lines between rules (unusual but consistent throughout — match it).
- Prefer editing existing files/patterns over introducing new ones (e.g., new form fields follow the existing `calc-field`/`calc-list-row` CSS classes rather than inventing new styling).
