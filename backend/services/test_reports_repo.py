from datetime import date

from services import gcs_storage
from services.db import get_pool

_SELECT_FIELDS = """
    id, document_id, report_no, test_object, norm, status,
    wizard_state, test_date, created_at, updated_at
"""


# asyncpg binds a DATE column against a real datetime.date, not a string —
# unlike every other column this app writes (TIMESTAMPTZ columns are all
# server-set via now()), test_date is the first place a raw "YYYY-MM-DD"
# string coming straight off the wire needs converting before it can be
# bound, or asyncpg raises a DataError ("'str' object has no attribute
# 'toordinal'") at the query layer instead of failing validation cleanly.
def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


def _row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "documentId": row["document_id"],
        "reportNo": row["report_no"],
        "testObject": row["test_object"],
        "norm": row["norm"],
        "status": row["status"],
        "wizardState": row["wizard_state"],
        "testDate": row["test_date"].isoformat() if row["test_date"] else None,
        "createdAt": row["created_at"].isoformat(),
        "updatedAt": row["updated_at"].isoformat(),
    }


# List view for Test Report Overview — deliberately does NOT select
# wizard_state (it can grow large and Overview never needs it, only the
# summary columns the table actually shows).
async def list_reports() -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, document_id, report_no, test_object, norm, status,
               test_date, created_at, updated_at
        FROM test_reports
        ORDER BY created_at DESC
        """
    )
    return [
        {
            "id": row["id"],
            "documentId": row["document_id"],
            "reportNo": row["report_no"],
            "testObject": row["test_object"],
            "norm": row["norm"],
            "status": row["status"],
            "testDate": row["test_date"].isoformat() if row["test_date"] else None,
            "createdAt": row["created_at"].isoformat(),
            "updatedAt": row["updated_at"].isoformat(),
        }
        for row in rows
    ]


async def get_report(report_id: int) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(f"SELECT {_SELECT_FIELDS} FROM test_reports WHERE id = $1", report_id)
    return _row_to_dict(row) if row else None


# Backs Document Preview's "Test erforderlich" checkbox reflecting reality
# when a document is reopened from All Documents — the most recently
# created report linked to this document, if any (normally at most one,
# since unchecking the box deletes its draft; LIMIT 1 / ORDER BY is just a
# safety net, not a sign multiple are expected).
async def get_report_by_document_id(document_id: int) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        f"""
        SELECT {_SELECT_FIELDS} FROM test_reports
        WHERE document_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        """,
        document_id,
    )
    return _row_to_dict(row) if row else None


# Creates the draft row — fired the moment "Test erforderlich" is chosen
# and saved in Document Preview (document_id set), or from the sidebar's
# "Generate Report" with no source document (document_id None). wizard_state
# is whatever prefill was already resolved (KB lookup results, extracted
# part/drawing fields) — an empty dict when starting from scratch is fine,
# same as the wizard's own useState defaults today.
async def create_report(
    document_id: int | None,
    report_no: str,
    test_object: str,
    norm: str,
    wizard_state: dict,
    test_date: str | None,
) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        f"""
        INSERT INTO test_reports (document_id, report_no, test_object, norm, wizard_state, test_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING {_SELECT_FIELDS}
        """,
        document_id,
        report_no or "",
        test_object or "",
        norm or "",
        wizard_state or {},
        _parse_date(test_date),
    )
    return _row_to_dict(row)


# The Save button — one full snapshot of the wizard's current state,
# mirroring how Calculation's own Save (documents_repo.update_document)
# rewrites its whole form in one go rather than patching field by field.
async def update_report(
    report_id: int,
    report_no: str | None,
    test_object: str | None,
    norm: str | None,
    wizard_state: dict | None,
    test_date: str | None,
    status: str | None,
) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        f"""
        UPDATE test_reports SET
            report_no = COALESCE($2, report_no),
            test_object = COALESCE($3, test_object),
            norm = COALESCE($4, norm),
            wizard_state = COALESCE($5, wizard_state),
            test_date = COALESCE($6, test_date),
            status = COALESCE($7, status),
            updated_at = now()
        WHERE id = $1
        RETURNING {_SELECT_FIELDS}
        """,
        report_id,
        report_no,
        test_object,
        norm,
        wizard_state,
        _parse_date(test_date),
        status,
    )
    return _row_to_dict(row) if row else None


# Cascades to test_report_images at the DB level (ON DELETE CASCADE), but
# the GCS objects themselves are a separate system the database can't
# clean up on its own — the rows are fetched first so their object paths
# can be deleted from the bucket after the DB delete succeeds.
async def delete_report(report_id: int) -> bool:
    pool = await get_pool()
    image_rows = await pool.fetch("SELECT object_path FROM test_report_images WHERE test_report_id = $1", report_id)
    result = await pool.execute("DELETE FROM test_reports WHERE id = $1", report_id)
    deleted = result != "DELETE 0"
    if deleted:
        for row in image_rows:
            gcs_storage.delete_object(row["object_path"])
    return deleted


# --- Images ------------------------------------------------------------
# Deliberately its own small table (test_report_images) rather than trying
# to walk wizard_state's arbitrary nested JSON to find every image
# reference — the frontend tells us explicitly what it uploaded and under
# what slot key, and this table is the only thing that needs to know an
# object_path exists at all (for cleanup on delete/replace).


async def record_image(report_id: int, slot: str, upload_result: dict) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO test_report_images (test_report_id, slot, object_path, content_type, file_size, original_filename)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, slot, object_path, content_type, file_size, original_filename, created_at
        """,
        report_id,
        slot,
        upload_result["objectPath"],
        upload_result.get("contentType"),
        upload_result.get("fileSize"),
        upload_result.get("originalFilename"),
    )
    return {
        "id": row["id"],
        "slot": row["slot"],
        "objectPath": row["object_path"],
        "contentType": row["content_type"],
        "fileSize": row["file_size"],
        "originalFilename": row["original_filename"],
        "createdAt": row["created_at"].isoformat(),
    }


# Removes both the bookkeeping row and the actual GCS object — called when
# the user replaces or clears a photo slot in the wizard, same "revoke the
# old one immediately" discipline the frontend's own object-URL cleanup
# already follows for the in-browser preview blobs.
async def delete_image(report_id: int, object_path: str) -> bool:
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM test_report_images WHERE test_report_id = $1 AND object_path = $2",
        report_id,
        object_path,
    )
    deleted = result != "DELETE 0"
    if deleted:
        gcs_storage.delete_object(object_path)
    return deleted


# Ownership check used before handing out a signed URL — object paths are
# opaque strings the frontend passes back on read; this confirms the path
# actually belongs to the report being asked about rather than trusting
# the caller, since a signed URL is a bearer credential for that one object.
async def image_belongs_to_report(report_id: int, object_path: str) -> bool:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT 1 FROM test_report_images WHERE test_report_id = $1 AND object_path = $2",
        report_id,
        object_path,
    )
    return row is not None
