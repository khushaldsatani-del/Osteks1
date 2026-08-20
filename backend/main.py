import os
from contextlib import asynccontextmanager
from urllib.parse import quote

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from services import documents_repo, emails_repo
from services.db import close_db, init_db
from services.email_processing import detect_email_kind, parse_email_buffer
from services.gemini_client import describe_extraction_error, extract_drawing_info
from services.file_processing import convert_to_image_pages, detect_file_kind

MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024  # 30 MB, same cap as the Node backend's multer config


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
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
        "apiKeyConfigured": bool(os.environ.get("GEMINI_API_KEY")),
        "databaseConfigured": bool(os.environ.get("DATABASE_URL")),
    }


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


# --- Documents (Neon-backed) ------------------------------------------------
# A document row is created right after /api/extract succeeds (see the
# frontend's Documents.jsx), not when Calculation's Save is clicked — Save
# only updates the pricing/offer fields on that same row.


class CreateDocumentBody(BaseModel):
    fileName: str
    fileKind: str | None = None
    extractionSummary: str | None = None


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


class UpdateStatusBody(BaseModel):
    status: str


@app.get("/api/documents")
async def list_documents():
    return await documents_repo.list_documents()


@app.post("/api/documents")
async def create_document(body: CreateDocumentBody):
    return await documents_repo.create_document(body.fileName, body.fileKind, body.extractionSummary)


@app.patch("/api/documents/{document_id}")
async def update_document(document_id: int, body: UpdateDocumentBody):
    return await documents_repo.update_document(document_id, body.model_dump())


@app.patch("/api/documents/{document_id}/status")
async def update_document_status(document_id: int, body: UpdateStatusBody):
    updated = await documents_repo.update_status(document_id, body.status)
    if updated is None:
        return JSONResponse(status_code=404, content={"error": "Document not found."})
    return updated


@app.delete("/api/documents/{document_id}")
async def delete_document(document_id: int):
    deleted = await documents_repo.delete_document(document_id)
    if not deleted:
        return JSONResponse(status_code=404, content={"error": "Document not found."})
    return {"ok": True}


# --- Emails (storage + link only — never sent to Gemini or any AI) ---------


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


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    print("Unexpected server error:", repr(exc))
    return JSONResponse(status_code=500, content={"error": "Unexpected server error."})


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 5001))
    if not os.environ.get("GEMINI_API_KEY"):
        print("GEMINI_API_KEY is not set — copy backend/.env.example to backend/.env and add your key.")
    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL is not set — copy backend/.env.example to backend/.env and add your Neon connection string.")
    print(f"Extraction backend (Python) listening on http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
