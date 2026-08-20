# Extraction + documents backend

Reads an uploaded engineering drawing (TIFF, PNG, JPG, JPEG, or PDF) and returns a clean text summary of the manufacturing information on it (part info, material, thickness, weight, coating), using Gemini's vision. Also persists documents/calculation/offer-details to Postgres (Neon), and stores (never AI-processes) an optional linked email per document.

Python (FastAPI + uvicorn). Originally built as a Node/Express service and ported to Python — see "Notes on the Python port" below for anything specific to that history.

## Setup

```
cd backend
python -m venv .venv
.venv\Scripts\activate      (Windows)  —  or  source .venv/bin/activate  (macOS/Linux)
pip install -r requirements.txt
copy .env.example .env
```

Open `.env` and fill in `GEMINI_API_KEY` (https://aistudio.google.com/apikey) and `DATABASE_URL` (a Postgres connection string — Neon: https://console.neon.tech). Tables are created automatically on startup if they don't exist yet (`services/db.py`'s `init_db()`).

## Run

```
python main.py
```

Server starts on `http://localhost:5001` (override with `PORT` in `.env`). The frontend calls it automatically — no extra wiring needed (`VITE_BACKEND_URL` in the frontend defaults to `http://localhost:5001`).

## Endpoints

**Extraction** (AI, Gemini — unchanged since the Python port):
- `POST /api/extract` — multipart form, field name `file` (single file). Returns `{ summary, meta }` on success, `{ error }` on failure. Used by the "Upload File" card.

**Documents** (Postgres-backed; a row is created right after `/api/extract` succeeds, then updated by Calculation's Save — see `src/pages/Documents.jsx`):
- `GET /api/documents` — list, for the All Documents page (includes the linked email's id/subject, if any).
- `POST /api/documents` — `{fileName, fileKind?, extractionSummary?}` → creates a row.
- `PATCH /api/documents/{id}` — `{norm, customerName, customerNumber, pricePerStk, annualQuantity, firmaInfo, calculationData, offerDetailsRows, ...}` → Calculation Save.
- `PATCH /api/documents/{id}/status`, `DELETE /api/documents/{id}` — All Documents' status dropdown / row delete.

**Emails** (storage + link only — **never** sent to Gemini or any AI; see the business rule below):
- `POST /api/emails/upload` — multipart, `email` file (`.eml` or Outlook `.msg`) + `document_id` field. Parses and stores the email + its attachments, links it to that document (one email per document). Returns full detail.
- `GET /api/emails/{id}` — full detail (from/to/cc/date/subject/body/attachments) for the "Email Details" modal.
- `DELETE /api/emails/{id}` — unlink/remove.
- `GET /api/emails/{id}/download`, `GET /api/emails/attachments/{attachment_id}/download` — raw file downloads.

## Files

| File | Role |
|---|---|
| `main.py` | FastAPI app — CORS, every route, error-response shaping. |
| `services/file_processing.py` | `detect_file_kind()` / `convert_to_image_pages()` — turns a raw PDF/TIFF/image buffer into the labeled, tiled PNG pages the vision model reads. |
| `services/gemini_client.py` | All Gemini calls: the two-stage drawing pipeline, retry/backoff, and `describe_extraction_error()`. |
| `prompts/extraction_prompt.py` | The system/user prompts, including the field list and output format. |
| `services/db.py` | `asyncpg` pool + `init_db()` (creates tables if missing) against `DATABASE_URL`. |
| `services/documents_repo.py` | CRUD for the `documents` table, including the `emails` join used for the All Documents Mail column. |
| `services/email_processing.py` | Parses a `.eml`/`.msg` buffer into subject/from/to/cc/date/body + attachment bytes. **Storage-only** — no AI calls of any kind live here. |
| `services/emails_repo.py` | CRUD for `emails`/`email_attachments`, including raw-bytes retrieval for downloads. |

## Business rule: technical file = AI, email = storage only

The email upload path (`/api/emails/upload` → `services/email_processing.py` → `services/emails_repo.py`) never imports or calls `services/gemini_client.py`. An email and its attachments are parsed only for display (subject/from/to/cc/date/body/attachment list) and stored as raw bytes for download — they never influence extraction, never get embedded, and never reach any AI provider. Only the technical drawing goes through `/api/extract` → Gemini.

## Notes on the Python port

This backend started as a Node/Express service (`@google/genai`, `sharp`, `pdf-to-png-converter`) and was ported to Python function-for-function — same route, same request/response shape, same two-stage extraction pipeline, using `google-genai` (Google's official Python SDK) via its async client, PyMuPDF for PDF rendering, and Pillow for tiling.

One real bug was caught and fixed during the port: Python's built-in `round()` uses banker's-rounding (`round(2.5) == 2`), but JS's `Math.round()` always rounds half up (`Math.round(2.5) === 3`). The tile-grid math in `services/file_processing.py` uses a small `_js_round()` helper (`floor(x + 0.5)`) everywhere the original relied on `Math.round()`, so a given drawing produces the same tile grid it always did.

Pillow's decompression-bomb guard was also raised (`Image.MAX_IMAGE_PIXELS`, in `file_processing.py`) — its ~179-megapixel default is tuned for arbitrary untrusted internet uploads and rejected a legitimate ~186-megapixel high-DPI drawing scan. Raised generously (400 megapixels) rather than disabled outright; the 30 MB upload cap in `main.py` remains the real bound on decode cost.

An AI-driven email pipeline (`.eml`/`.msg` ingestion sent to Gemini/Groq for extraction) was built and later fully removed. The email support that exists now (see above) is a separate, storage-only rebuild — same file-parsing approach, deliberately no AI involvement this time, per an explicit business requirement.

Every piece was verified against the real, running Neon database and a real Chromium browser session before being called done: every new endpoint exercised live via HTTP (create/update/status/delete/cascade-delete, duplicate-email rejection, attachment/original-file download with correct headers), and the frontend driven end-to-end (All Documents' Mail column, the Email Details modal with real data, status change and delete round-tripping through the actual UI).
