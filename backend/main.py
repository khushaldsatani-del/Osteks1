import asyncio
import json
import os
from contextlib import asynccontextmanager
from urllib.parse import quote

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

from services import documents_repo, emails_repo, gcs_storage, kb_repo, test_reports_repo
from services.db import close_db, get_pool, init_db
from services.email_extraction import extract_calculation_from_email
from services.email_processing import detect_email_kind, parse_email_buffer
from services.kb_db import init_kb_schema
from services.openai_client import describe_extraction_error, extract_drawing_info
from services.file_processing import convert_to_image_pages, detect_file_kind
from services.test_reports_db import init_test_reports_schema

MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024  # 30 MB, same cap as the Node backend's multer config
MAX_IMAGE_SLOTS = 4  # keep in sync with frontend/src/pages/Documents.jsx's MAX_IMAGES


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Standards/document knowledge base — fully separate schema (see
    # services/kb_db.py). Read-only from the web app's side (the
    # /api/kb/lookup route below, which the Specification feature depends
    # on); its data was extracted and saved out-of-band, via a standalone
    # CLI that's since been removed along with the browsing page it
    # supported — never through HTTP either way.
    await init_kb_schema()
    # Test Report records (see services/test_reports_db.py) — references
    # documents(id), so this runs after init_db() has created that table.
    await init_test_reports_schema()
    yield
    await close_db()


app = FastAPI(lifespan=lifespan)

_allowed_origins = [origin.strip() for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    # No ALLOWED_ORIGINS configured -> local dev default, allow any origin —
    # same fallback the Node backend uses.
    allow_origins=_allowed_origins or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "apiKeyConfigured": bool(os.environ.get("OPENAI_API_KEY")),
        "databaseConfigured": bool(os.environ.get("DATABASE_URL")),
    }


# Deliberately separate from /api/health above, which only checks env vars
# and never touches the database — pinging that alone keeps the Render web
# service awake (see .github/workflows/keep-backend-warm.yml) but does
# nothing for Neon's own serverless Postgres compute, which independently
# suspends after its own idle period. This runs one trivial query so a
# scheduled ping here keeps that compute warm too — the actual fix for the
# 1-2s delay on "Open in Workspace" after a few idle minutes (that delay is
# Neon's compute waking back up on the first real query, not anything in
# this app's own code).
@app.get("/api/health/db")
async def health_db():
    pool = await get_pool()
    await pool.fetchval("SELECT 1")
    return {"ok": True}


async def _read_and_check_size(upload: UploadFile) -> bytes:
    data = await upload.read()
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"'{upload.filename}' exceeds the 30 MB upload limit.")
    return data


def _content_disposition(filename: str) -> str:
    ascii_fallback = filename.encode("ascii", "ignore").decode("ascii") or "download"
    return f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{quote(filename)}'


@app.post("/api/extract")
async def extract(file: UploadFile | None = File(None)):
    if not file or not file.filename:
        return JSONResponse(status_code=400, content={"error": "No file was uploaded. Attach a file under the 'file' field."})

    try:
        buffer = await _read_and_check_size(file)
    except ValueError as error:
        return JSONResponse(status_code=400, content={"error": f"Upload error: {error}"})

    kind = detect_file_kind(file.filename, file.content_type or "")
    if not kind:
        return JSONResponse(
            status_code=400,
            content={"error": "Unsupported file type. Upload a TIFF, PNG, JPG, JPEG, or PDF drawing."},
        )

    try:
        images = convert_to_image_pages(buffer, kind)
        summary = await extract_drawing_info(images)
        return {
            "summary": summary,
            "meta": {"fileName": file.filename, "fileKind": kind, "imagesAnalyzed": len(images)},
        }
    except Exception as error:  # noqa: BLE001
        print("Extraction failed:", repr(error))
        described = describe_extraction_error(error, "Could not extract information from this drawing.")
        status = 500 if described["is_config_error"] else 502
        return JSONResponse(status_code=status, content={"error": described["message"]})


# Shared plumbing for the two streaming extraction endpoints below
# (/api/extract-stream for drawings, /api/extract-email-stream for emails):
# runs `run(emit)` as a background task and answers as a newline-delimited
# JSON stream of REAL progress events (emit(...) puts an event on the
# stream), so the frontend's progress bar reflects what the server is
# actually doing rather than a timer. `run` emits events like
# {"type": "received"}, "converted", per-stage "start"/"done" + live
# "tokens" counts, and finally one {"type": "result", ...}. Any exception
# `run` raises becomes a final {"type": "error"} event with the same
# user-facing message the non-streaming endpoints return. A "tick" is sent
# every few seconds of silence purely as a keepalive so no proxy ever sees
# the connection as idle during the AI stages' long reasoning phase (no
# visible tokens are produced during that phase).
def _ndjson_stream(run, fallback_prefix: str) -> StreamingResponse:
    queue: asyncio.Queue = asyncio.Queue()

    async def pipeline():
        try:
            await run(queue.put_nowait)
        except Exception as error:  # noqa: BLE001
            print("Extraction failed:", repr(error))
            described = describe_extraction_error(error, fallback_prefix)
            queue.put_nowait({"type": "error", "error": described["message"]})
        finally:
            queue.put_nowait(None)

    async def event_stream():
        task = asyncio.create_task(pipeline())
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=5)
                except asyncio.TimeoutError:
                    yield json.dumps({"type": "tick"}) + "\n"
                    continue
                if event is None:
                    break
                yield json.dumps(event) + "\n"
        finally:
            # Client went away mid-extraction (closed the tab, navigated
            # off the page) — stop paying for an AI call nobody will read.
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# Same extraction as /api/extract above (same validation, same conversion,
# same two-stage AI pipeline, same final summary) — answered as a stream of
# real progress events (see _ndjson_stream). Anything wrong with the upload
# itself is still an ordinary 4xx JSON response, before any streaming starts.
@app.post("/api/extract-stream")
async def extract_stream(file: UploadFile | None = File(None)):
    if not file or not file.filename:
        return JSONResponse(status_code=400, content={"error": "No file was uploaded. Attach a file under the 'file' field."})

    try:
        buffer = await _read_and_check_size(file)
    except ValueError as error:
        return JSONResponse(status_code=400, content={"error": f"Upload error: {error}"})

    kind = detect_file_kind(file.filename, file.content_type or "")
    if not kind:
        return JSONResponse(
            status_code=400,
            content={"error": "Unsupported file type. Upload a TIFF, PNG, JPG, JPEG, or PDF drawing."},
        )

    async def run(emit):
        emit({"type": "received", "bytes": len(buffer)})
        emit({"type": "converting"})
        # Worker thread so events/ticks keep flowing during a large PDF's
        # rendering instead of the event loop stalling on it.
        images = await asyncio.to_thread(convert_to_image_pages, buffer, kind)
        emit({"type": "converted", "images": len(images)})
        summary = await extract_drawing_info(images, on_event=emit)
        emit(
            {
                "type": "result",
                "summary": summary,
                "meta": {"fileName": file.filename, "fileKind": kind, "imagesAnalyzed": len(images)},
            }
        )

    return _ndjson_stream(run, "Could not extract information from this drawing.")


# Email-only calculation source: only ever called by the frontend when no
# drawing has been uploaded for this offer (see UploadFile.jsx's
# hasImageSource guard) — once any image exists, email stays storage/link
# only via /api/emails/upload below, same as before this endpoint existed.
@app.post("/api/extract-email")
async def extract_email_calculation(email: UploadFile = File(...), max_parts: int = Form(MAX_IMAGE_SLOTS)):
    if not email.filename:
        return JSONResponse(status_code=400, content={"error": "No email file was uploaded."})

    kind = detect_email_kind(email.filename, email.content_type or "")
    if not kind:
        return JSONResponse(status_code=400, content={"error": "Unsupported email format. Upload a .eml or .msg file."})

    try:
        buffer = await _read_and_check_size(email)
    except ValueError as error:
        return JSONResponse(status_code=400, content={"error": f"Upload error: {error}"})

    try:
        parsed = parse_email_buffer(buffer, is_msg=(kind == "msg"))
    except Exception as error:  # noqa: BLE001
        print("Email parsing failed:", repr(error))
        return JSONResponse(status_code=400, content={"error": "Could not parse this email file."})

    try:
        parts = await extract_calculation_from_email(parsed, max_parts=max(1, min(max_parts, MAX_IMAGE_SLOTS)))
        if not parts:
            return JSONResponse(
                status_code=422, content={"error": "No calculation-relevant data could be found in this email."}
            )
        return {"parts": parts}
    except Exception as error:  # noqa: BLE001
        print("Email extraction failed:", repr(error))
        described = describe_extraction_error(error, "Could not extract information from this email.")
        status = 500 if described["is_config_error"] else 502
        return JSONResponse(status_code=status, content={"error": described["message"]})


# Same extraction as /api/extract-email above, answered as a stream of real
# progress events (see _ndjson_stream) — the final event is
# {"type": "result", "parts": [...]}, the same list the plain endpoint
# returns, or an error event carrying the same "no calculation-relevant
# data" message the plain endpoint answers with a 422.
@app.post("/api/extract-email-stream")
async def extract_email_stream(email: UploadFile = File(...), max_parts: int = Form(MAX_IMAGE_SLOTS)):
    if not email.filename:
        return JSONResponse(status_code=400, content={"error": "No email file was uploaded."})

    kind = detect_email_kind(email.filename, email.content_type or "")
    if not kind:
        return JSONResponse(status_code=400, content={"error": "Unsupported email format. Upload a .eml or .msg file."})

    try:
        buffer = await _read_and_check_size(email)
    except ValueError as error:
        return JSONResponse(status_code=400, content={"error": f"Upload error: {error}"})

    async def run(emit):
        emit({"type": "received", "bytes": len(buffer)})
        emit({"type": "converting"})
        try:
            parsed = parse_email_buffer(buffer, is_msg=(kind == "msg"))
        except Exception as error:  # noqa: BLE001
            print("Email parsing failed:", repr(error))
            emit({"type": "error", "error": "Could not parse this email file."})
            return
        parts = await extract_calculation_from_email(
            parsed, max_parts=max(1, min(max_parts, MAX_IMAGE_SLOTS)), on_event=emit
        )
        if not parts:
            emit({"type": "error", "error": "No calculation-relevant data could be found in this email."})
            return
        emit({"type": "result", "parts": parts})

    return _ndjson_stream(run, "Could not extract information from this email.")


# --- Documents (Neon-backed) ------------------------------------------------
# A document row is created right after /api/extract succeeds (see the
# frontend's Documents.jsx), not when Calculation's Save is clicked — Save
# only updates the pricing/offer fields on that same row.


class CreateDocumentBody(BaseModel):
    fileName: str
    fileKind: str | None = None
    extractionSummary: str | None = None
    # Set when this is image 2 or 3 of an offer that already has a first
    # (parent) image — see services/documents_repo.py's self-referencing
    # parent_document_id column.
    parentDocumentId: int | None = None
    imageSlot: int = 1


class UpdateDocumentBody(BaseModel):
    fileName: str | None = None
    fileKind: str | None = None
    extractionSummary: str | None = None
    norm: str | None = None
    customerName: str | None = None
    customerNumber: str | None = None
    pricePerStk: float | None = None
    annualQuantity: float | None = None
    firmaInfo: dict | None = None
    calculationData: dict | None = None
    offerDetailsRows: list | None = None
    offerDetailsValues: dict | None = None
    parentDocumentId: int | None = None
    imageSlot: int | None = None
    kbSpecification: dict | None = None


class UpdateStatusBody(BaseModel):
    status: str


class SetKbSpecificationBody(BaseModel):
    kbSpecification: dict | None = None


@app.get("/api/documents")
async def list_documents():
    return await documents_repo.list_documents()


@app.get("/api/documents/{document_id}")
async def get_document(document_id: int):
    document = await documents_repo.get_document_with_images(document_id)
    if document is None:
        return JSONResponse(status_code=404, content={"error": "Document not found."})
    return document


@app.post("/api/documents")
async def create_document(body: CreateDocumentBody):
    if body.imageSlot < 1 or body.imageSlot > MAX_IMAGE_SLOTS:
        return JSONResponse(status_code=400, content={"error": f"imageSlot must be between 1 and {MAX_IMAGE_SLOTS}."})

    if body.parentDocumentId is not None:
        parent = await documents_repo.get_document(body.parentDocumentId)
        if parent is None or parent.get("parentDocumentId") is not None:
            return JSONResponse(status_code=400, content={"error": "parentDocumentId must reference an existing top-level document."})
        siblings = await documents_repo.get_document_with_images(body.parentDocumentId)
        if len(siblings["images"]) >= MAX_IMAGE_SLOTS:
            return JSONResponse(status_code=400, content={"error": f"An offer can have at most {MAX_IMAGE_SLOTS} images."})

    return await documents_repo.create_document(
        body.fileName, body.fileKind, body.extractionSummary, body.parentDocumentId, body.imageSlot
    )


@app.patch("/api/documents/{document_id}")
async def update_document(document_id: int, body: UpdateDocumentBody):
    return await documents_repo.update_document(document_id, body.model_dump())


@app.patch("/api/documents/{document_id}/status")
async def update_document_status(document_id: int, body: UpdateStatusBody):
    updated = await documents_repo.update_status(document_id, body.status)
    if updated is None:
        return JSONResponse(status_code=404, content={"error": "Document not found."})
    return updated


# Narrow write path, separate from the general PATCH above — persists the
# Standards-KB lookup result the moment it resolves after extraction,
# before the user has necessarily clicked Save (see documents_repo.py's
# set_kb_specification for why this can't just reuse update_document).
@app.patch("/api/documents/{document_id}/specification")
async def set_document_kb_specification(document_id: int, body: SetKbSpecificationBody):
    updated = await documents_repo.set_kb_specification(document_id, body.kbSpecification)
    if updated is None:
        return JSONResponse(status_code=404, content={"error": "Document not found."})
    return updated


@app.delete("/api/documents/{document_id}")
async def delete_document(document_id: int):
    deleted = await documents_repo.delete_document(document_id)
    if not deleted:
        return JSONResponse(status_code=404, content={"error": "Document not found."})
    return {"ok": True}


# --- Emails (storage + link only — never sent to OpenAI or any AI) ---------


@app.post("/api/emails/upload")
async def upload_email(email: UploadFile = File(...), document_id: int = Form(...)):
    if not email.filename:
        return JSONResponse(status_code=400, content={"error": "No email file was uploaded."})

    kind = detect_email_kind(email.filename, email.content_type or "")
    if not kind:
        return JSONResponse(status_code=400, content={"error": "Unsupported email format. Upload a .eml or .msg file."})

    try:
        buffer = await _read_and_check_size(email)
    except ValueError as error:
        return JSONResponse(status_code=400, content={"error": f"Upload error: {error}"})

    document = await documents_repo.get_document(document_id)
    if document is None:
        return JSONResponse(status_code=404, content={"error": "The linked document was not found."})

    try:
        parsed = parse_email_buffer(buffer, is_msg=(kind == "msg"))
    except Exception as error:  # noqa: BLE001
        print("Email parsing failed:", repr(error))
        return JSONResponse(status_code=400, content={"error": "Could not parse this email file."})

    try:
        return await emails_repo.create_email(
            document_id, email.filename, kind, parsed, buffer, email.content_type or "application/octet-stream"
        )
    except Exception as error:  # noqa: BLE001
        print("Email storage failed:", repr(error))
        if "unique" in str(error).lower():
            return JSONResponse(
                status_code=409, content={"error": "This document already has an email attached. Remove it first."}
            )
        return JSONResponse(status_code=500, content={"error": "Could not store this email."})


@app.get("/api/emails/{email_id}")
async def get_email(email_id: int):
    result = await emails_repo.get_email(email_id)
    if result is None:
        return JSONResponse(status_code=404, content={"error": "Email not found."})
    return result


@app.delete("/api/emails/{email_id}")
async def delete_email(email_id: int):
    deleted = await emails_repo.delete_email(email_id)
    if not deleted:
        return JSONResponse(status_code=404, content={"error": "Email not found."})
    return {"ok": True}


@app.get("/api/emails/{email_id}/download")
async def download_email(email_id: int):
    raw = await emails_repo.get_email_raw(email_id)
    if raw is None:
        return JSONResponse(status_code=404, content={"error": "Email not found."})
    return Response(
        content=bytes(raw["data"]),
        media_type=raw["mimetype"] or "application/octet-stream",
        headers={"Content-Disposition": _content_disposition(raw["file_name"])},
    )


@app.get("/api/emails/attachments/{attachment_id}/download")
async def download_attachment(attachment_id: int):
    attachment = await emails_repo.get_attachment(attachment_id)
    if attachment is None:
        return JSONResponse(status_code=404, content={"error": "Attachment not found."})
    return Response(
        content=bytes(attachment["data"]),
        media_type=attachment["content_type"] or "application/octet-stream",
        headers={"Content-Disposition": _content_disposition(attachment["file_name"])},
    )


# --- Standards/document knowledge base lookup -------------------------------
# See services/kb_repo.py / kb_db.py. Fully separate from the
# documents/emails tables above. The Standards DB browsing page (search/
# list/get-full-document) has been removed along with its routes — this is
# the one KB route still in use, since the main Specification feature
# depends on it. Data itself is unaffected: it's read-only against tables
# populated out-of-band by a now-removed standalone CLI, never through HTTP.


# Condensed lookup consumed by the image/email extraction workflow (see
# frontend/src/pages/Documents.jsx) — takes whatever free text was read off
# a drawing/email as the surface-treatment/spec designation (e.g.
# "VW 13750 - Ofl-x633 TL227") and returns only the handful of cost-relevant
# facts, or {"matched": false} when nothing in the KB matches.
@app.get("/api/kb/lookup")
async def kb_lookup(q: str = ""):
    if not q.strip():
        return {"matched": False}
    result = await kb_repo.lookup_specification(q.strip())
    return result or {"matched": False}


# --- Test Reports (Neon-backed, images in Google Cloud Storage) ------------
# See services/test_reports_db.py, test_reports_repo.py, gcs_storage.py.
# A report row is created as a draft the moment "Test erforderlich" is
# chosen in Document Preview (document_id set, prefilled wizardState from
# whatever the Standards-KB lookup + drawing extraction already resolved)
# — or from scratch via the sidebar's "Generate Report" (document_id None).
# The wizard's Save button PATCHes the whole wizardState snapshot back;
# Download stays a pure client-side export, untouched by any of this.


class CreateTestReportBody(BaseModel):
    documentId: int | None = None
    reportNo: str = ""
    testObject: str = ""
    norm: str = ""
    wizardState: dict = {}
    testDate: str | None = None


class UpdateTestReportBody(BaseModel):
    reportNo: str | None = None
    testObject: str | None = None
    norm: str | None = None
    wizardState: dict | None = None
    testDate: str | None = None
    status: str | None = None


@app.get("/api/test-reports")
async def list_test_reports():
    return await test_reports_repo.list_reports()


@app.get("/api/test-reports/{report_id}")
async def get_test_report(report_id: int):
    report = await test_reports_repo.get_report(report_id)
    if report is None:
        return JSONResponse(status_code=404, content={"error": "Test report not found."})
    return report


# Lets Document Preview's "Test erforderlich" checkbox reflect reality when
# a document is reopened from All Documents, instead of always resetting to
# unchecked — returns null (200, not 404) when no report is linked, since
# "no report yet" is an entirely normal, expected answer here.
@app.get("/api/test-reports/by-document/{document_id}")
async def get_test_report_by_document(document_id: int):
    return await test_reports_repo.get_report_by_document_id(document_id)


@app.post("/api/test-reports")
async def create_test_report(body: CreateTestReportBody):
    if body.documentId is not None:
        document = await documents_repo.get_document(body.documentId)
        if document is None:
            return JSONResponse(status_code=400, content={"error": "documentId must reference an existing document."})
    return await test_reports_repo.create_report(
        body.documentId, body.reportNo, body.testObject, body.norm, body.wizardState, body.testDate
    )


@app.patch("/api/test-reports/{report_id}")
async def update_test_report(report_id: int, body: UpdateTestReportBody):
    updated = await test_reports_repo.update_report(
        report_id, body.reportNo, body.testObject, body.norm, body.wizardState, body.testDate, body.status
    )
    if updated is None:
        return JSONResponse(status_code=404, content={"error": "Test report not found."})
    return updated


@app.delete("/api/test-reports/{report_id}")
async def delete_test_report(report_id: int):
    deleted = await test_reports_repo.delete_report(report_id)
    if not deleted:
        return JSONResponse(status_code=404, content={"error": "Test report not found."})
    return {"ok": True}


# One image per call — `slot` is a free-form key the wizard chooses for its
# own bookkeeping (e.g. "cycle5.before", "crosscut.corrosion.after") so the
# same generic endpoint covers every photo slot in the wizard without the
# backend needing to know its shape. Returns the object path only, never a
# URL — see gcs_storage.py's signed_url() for why reads are always signed
# fresh rather than a stored link ever being reused.
@app.post("/api/test-reports/{report_id}/images")
async def upload_test_report_image(report_id: int, file: UploadFile = File(...), slot: str = Form(...)):
    report = await test_reports_repo.get_report(report_id)
    if report is None:
        return JSONResponse(status_code=404, content={"error": "Test report not found."})

    try:
        data = await _read_and_check_size(file)
    except ValueError as error:
        return JSONResponse(status_code=400, content={"error": f"Upload error: {error}"})

    try:
        upload_result = gcs_storage.upload_image(report_id, slot, data, file.content_type, file.filename)
    except RuntimeError as error:
        # GCS_BUCKET_NAME not configured yet — a setup problem, not a
        # per-request one, so this is a 500 rather than a 400.
        return JSONResponse(status_code=500, content={"error": str(error)})

    return await test_reports_repo.record_image(report_id, slot, upload_result)


# Proxies the image back through the backend rather than issuing a signed
# URL — see gcs_storage.py's download_bytes() for why. Same downstream
# shape as GET /api/emails/attachments/{id}/download, just backed by GCS
# instead of a BYTEA column; the frontend treats it as a plain image URL
# either way (an <img src=...> pointed at this endpoint works as-is).
@app.get("/api/test-reports/{report_id}/images/{object_path:path}/url")
async def get_test_report_image(report_id: int, object_path: str):
    owns = await test_reports_repo.image_belongs_to_report(report_id, object_path)
    if not owns:
        return JSONResponse(status_code=404, content={"error": "Image not found on this report."})
    try:
        data, content_type = gcs_storage.download_bytes(object_path)
    except RuntimeError as error:
        return JSONResponse(status_code=500, content={"error": str(error)})
    return Response(content=data, media_type=content_type)


@app.delete("/api/test-reports/{report_id}/images/{object_path:path}")
async def delete_test_report_image(report_id: int, object_path: str):
    try:
        deleted = await test_reports_repo.delete_image(report_id, object_path)
    except RuntimeError as error:
        return JSONResponse(status_code=500, content={"error": str(error)})
    if not deleted:
        return JSONResponse(status_code=404, content={"error": "Image not found on this report."})
    return {"ok": True}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    print("Unexpected server error:", repr(exc))
    return JSONResponse(status_code=500, content={"error": "Unexpected server error."})


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 5001))
    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set — copy backend/.env.example to backend/.env and add your key.")
    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL is not set — copy backend/.env.example to backend/.env and add your Neon connection string.")
    print(f"Extraction backend (Python) listening on http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
