# Architecture

Reference doc for how the Osteks app is put together. For narrative history (why things changed, bugs fixed, decisions made) see `MEMORY.md` — this file is the current-state map, not the story of how it got here.

---

## App Flow & Architecture

### High-level shape

- **Frontend**: React 19 + Vite 8 single-page app, no router — `App.jsx` holds one `currentPage` string in state and renders exactly one page component at a time. No global state library; state is either local to a component or lifted to the nearest common ancestor (`App.jsx` for anything that must survive switching pages, e.g. document/report lists).
- **Backend**: Python FastAPI app (`backend/main.py`), one process, no background workers/queues — every request is handled synchronously against Postgres/GCS/OpenAI.
- **Database**: Postgres, hosted on Neon. Plain `asyncpg` (no ORM) — one shared connection pool from `services/db.py`'s `get_pool()`, schema created/migrated via idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` blocks run at startup (`init_db()`), not a migrations framework.
- **File storage**: Google Cloud Storage — only Test Report photo uploads go here (`services/gcs_storage.py`); everything else (drawings, emails) is processed in-memory and only its *extracted data* is persisted, not the original file bytes.
- **AI**: OpenAI (vision model) for drawing/email field extraction and for the Standards Knowledge Base's PDF extraction pipeline. No other AI provider is wired in.

### Navigation / page flow

The sidebar (`Sidebar.jsx`) has 3 top-level entries; `App.jsx` swaps between their page components on click — nothing ever unmounts `App` itself, so lists fetched into its state (document records, test-report records) persist across navigation:

```
Work Place (Documents.jsx)          — the coating-cost calculator workspace
All Documents (AllDocuments.jsx)    — every saved offer, searchable/paginated
Test Report (accordion, 2 children)
  ├─ Overview (TestReportOverview.jsx)   — every saved Prüfbericht, searchable/paginated
  └─ Generate Report (TestReport.jsx)    — the 5-step wizard
```

### Work Place flow (coating cost calculator)

1. User drops 1-3 drawings (PDF/PNG/JPG/TIFF) + optionally one email (`.eml`/Outlook `.msg`) into one combined drop zone (`UploadFile.jsx`).
2. Each drawing is sent to `/api/extract` **one at a time, in sequence** (never parallel — accuracy depends on this) → OpenAI vision extracts material/thickness/weight/coating spec/etc. → a `documents` row is created the moment extraction succeeds (not when the user saves).
3. Extracted values seed `Calculation.jsx` (cost formulas) and `OfferDetails.jsx` (the editable offer fields) — one independent instance per uploaded image, switchable via tabs.
4. `DocPreview.jsx` renders the live "Angebot" (offer letter) matching the company's real quote format; exportable as PDF (`jspdf`/`html2canvas`, client-side only) or `.docx` (`buildDocx.js`, via the `docx` library).
5. Save `PATCH`es each image's `documents` row with pricing/offer/calculation data. An email, if staged, is only uploaded (`/api/emails/upload`) once the first drawing's extraction has already succeeded.

### Test Report flow (Prüfbericht wizard)

1. A report is started either from the sidebar (blank) or from Work Place's Document Preview via a **"Test required" checkbox** (independent of the With/Without Specification radio group) — which auto-creates a draft `test_reports` row pre-filled from that document's AI-extracted part name/norm.
2. 5-step wizard (`TestReport.jsx` owns all state; each step is a component under `components/TestReport/`): Basic Information → Test Conditions → Results → Evaluation → Preview & Export.
3. **Photos are select-now, upload-on-Save**: picking a file shows an instant local blob-URL preview; nothing reaches GCS until the user clicks **Speichern**, at which point every still-pending photo uploads and the whole wizard state is persisted as one JSONB blob (`test_reports.wizard_state`).
4. Step 5 assembles the real document dynamically from everything entered in steps 1-4 (no separate re-entry of photos/captions) — see `testReportDocData.js` for exactly which state maps to which section — and renders it two ways from the one shared data shape: a paginated on-screen preview (`TestReportPreview.jsx`) and a downloadable `.docx` (`buildTestReportDocx.js`, via the `docx` library).

### Persistence pattern (shared by both features)

A record is created in the database as soon as the thing it represents actually exists (extraction succeeded / a report was started), not deferred until an explicit "Save" — Save always means "update", never "first write". Every list view (`documentRecords`, `testReportRecords` in `App.jsx`) is refetched from the backend after any create/update/delete rather than mutated optimistically in place, so the UI can't drift from what's actually in Postgres.

---

## Folder & File Structure

```
Osteks_with_Calculation/
├── Architecture.md          — this file
├── Design.md                — colors, fonts, typography
├── MEMORY.md                — narrative project history (tracked in git)
├── .github/workflows/       — keeps the Render backend warm (ping every 10 min)
│
├── frontend/                — deployed independently (Vercel)
│   ├── src/
│   │   ├── main.jsx, App.jsx, App.css     — entry point, page switcher, global styles
│   │   ├── config.js                       — exports BACKEND_URL (env-driven)
│   │   ├── i18n/                           — EN/DE translation system
│   │   │   ├── LanguageContext.jsx         — useLanguage()/useTranslation() hooks
│   │   │   └── translations/en.js, de.js   — flat key → string maps
│   │   ├── pages/
│   │   │   ├── Documents.jsx               — Work Place page (owns the up-to-3-image workspace)
│   │   │   ├── TestReport.jsx              — the 5-step wizard's state + orchestration
│   │   │   └── TestReportOverview.jsx      — saved-reports list page
│   │   └── components/
│   │       ├── Sidebar/                    — nav
│   │       ├── Upload/                     — drop zone, uploaded-files table, info modal
│   │       ├── Extraction/                 — extraction progress/preview UI
│   │       ├── Calculation/                — cost engine + its Left/Right form halves
│   │       │   ├── calculationEngine.js    — the actual coating-cost formulas
│   │       │   ├── calculationDefaults.js, extractionParser.js, format.js, kbLookup.js
│   │       │   └── Left/, Right/           — the two form columns
│   │       ├── OfferDetails/               — editable offer-letter fields
│   │       ├── DocPreview/                 — offer letter preview + PDF/.docx export
│   │       ├── AllDocuments/               — saved-offers list + email/specification modals
│   │       ├── TestReport/                 — everything the wizard renders, one folder per step
│   │       │   ├── testReportConstants.js, testReportsApi.js, AutoTextarea.jsx, ImageUploadBox.jsx, Stepper.jsx
│   │       │   ├── BasicInformation/, TestConditions/, Results/, Evaluation/
│   │       │   └── PreviewExport/          — Step 5: on-screen preview + Word export
│   │       │       ├── TestReportPreview.jsx     — paginated on-screen document
│   │       │       ├── buildTestReportDocx.js    — .docx generation (docx library)
│   │       │       ├── testReportDocData.js      — shared "what goes where" data shape
│   │       │       ├── testReportImageLayout.js  — best-fit photo layout by aspect ratio
│   │       │       └── DocImageSlot.jsx          — one upload slot (logo/signature)
│   │       └── common/                     — CustomSelect.jsx (themeable dropdown)
│   └── package.json
│
└── backend/                 — deployed independently (Render)
    ├── main.py               — FastAPI app: every @app.get/post/patch/delete route lives here
    ├── prompts/              — OpenAI prompt text, one file per extraction task
    │   ├── extraction_prompt.py, email_extraction_prompt.py
    ├── services/             — one module per concern, plain async functions (no classes/ORM)
    │   ├── db.py                       — shared pool + documents/emails schema
    │   ├── documents_repo.py, emails_repo.py
    │   ├── file_processing.py          — PDF/image tiling + text extraction (PyMuPDF)
    │   ├── email_processing.py, email_extraction.py
    │   ├── openai_client.py            — the one place that calls OpenAI, incl. retry/error handling
    │   ├── gcs_storage.py              — Google Cloud Storage upload/download/delete
    │   ├── test_reports_db.py, test_reports_repo.py   — Prüfbericht schema + repo
    │   └── kb_db.py, kb_repo.py, kb_extraction.py     — Standards Knowledge Base (internal; see below)
    ├── requirements.txt, Dockerfile, cloudbuild.yaml
    └── README.md             — setup notes, AI-provider history, Python-port notes
```

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | React 19 + Vite 8 | No router, no Redux/Zustand — plain state + prop drilling |
| Frontend language | JavaScript (JSX), no TypeScript | `@types/react`/`@types/react-dom` present only for editor IntelliSense |
| Styling | Plain CSS, one `.css` file per component | No Tailwind/CSS-in-JS, **no CSS custom properties** — colors are literal hex values repeated per file (see `Design.md`) |
| Icons | `lucide-react` | |
| Document export (Work Place) | `jspdf` + `html2canvas` (PDF), `docx` (Word) | Client-side only, no server round-trip |
| Document export (Test Report) | `docx` | `buildTestReportDocx.js` — real OOXML, not an HTML-as-.doc hack |
| Linting | `oxlint` | `npm run lint` |
| Backend framework | FastAPI (Python) + `uvicorn` | Originally Node/Express, fully ported to Python |
| Backend DB access | `asyncpg`, raw SQL | No ORM/migration framework — idempotent `CREATE TABLE IF NOT EXISTS` at startup |
| Database | Postgres (Neon, serverless) | |
| Object storage | Google Cloud Storage | Test Report photos only; backend always proxies reads (`download_bytes`) rather than issuing signed URLs |
| AI provider | OpenAI (vision-capable model) | Replaced an earlier Gemini integration; see `backend/README.md`'s "AI provider history" |
| PDF/image handling | `PyMuPDF` (`fitz`), `Pillow` | Drawing tiling for vision extraction, PDF text extraction for the Standards KB |
| Email parsing | `extract-msg` (Outlook `.msg`), `html2text` | `.eml` handled by Python's stdlib |
| Deployment | Vercel (frontend), Render (backend), Neon (Postgres), GCS (storage) | `frontend/` and `backend/` deploy independently; a GitHub Action pings `/api/health` every 10 min to prevent Render's free-tier cold start |

**Two i18n locales** (EN/DE) cover the whole app via `LanguageContext.jsx` + flat translation-key files — the Test Report's Step 5 document itself is deliberately **not** translated (it's a fixed-format German Prüfbericht regardless of UI language).
