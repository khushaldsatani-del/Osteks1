from services.db import get_pool

# Every row returned by this module is already shaped in camelCase, matching
# the JSON the frontend expects — callers in main.py can return these dicts
# directly as a response body with no further translation.
_SELECT_FIELDS = """
    d.id, d.file_name, d.file_kind, d.extraction_summary,
    d.norm, d.customer_name, d.customer_number,
    d.price_per_stk, d.annual_quantity, d.status,
    d.firma_info, d.calculation_data, d.offer_details_rows, d.offer_details_values,
    d.kb_specification,
    d.parent_document_id, d.image_slot,
    d.uploaded_at, d.updated_at,
    e.id AS mail_email_id, e.subject AS mail_subject
"""

# Only top-level rows (one per offer) — an offer's 2nd/3rd images are child
# rows fetched together via get_document_with_images, never listed on their
# own, so All Documents / Uploaded Files keep showing exactly one row per
# offer regardless of how many images it has.
_LIST_SQL = f"""
SELECT {_SELECT_FIELDS}
FROM documents d
LEFT JOIN emails e ON e.document_id = d.id
WHERE d.parent_document_id IS NULL
ORDER BY d.uploaded_at DESC
"""

_GET_BY_ID_SQL = f"""
SELECT {_SELECT_FIELDS}
FROM documents d
LEFT JOIN emails e ON e.document_id = d.id
WHERE d.id = $1
"""

_GET_CHILDREN_SQL = f"""
SELECT {_SELECT_FIELDS}
FROM documents d
LEFT JOIN emails e ON e.document_id = d.id
WHERE d.parent_document_id = $1
ORDER BY d.image_slot
"""


def _row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "fileName": row["file_name"],
        "fileKind": row["file_kind"],
        "extractionSummary": row["extraction_summary"],
        "norm": row["norm"],
        "customerName": row["customer_name"],
        "customerNumber": row["customer_number"],
        "pricePerStk": float(row["price_per_stk"]),
        "annualQuantity": float(row["annual_quantity"]),
        "status": row["status"],
        "firmaInfo": row["firma_info"],
        "calculationData": row["calculation_data"],
        "offerDetailsRows": row["offer_details_rows"],
        "offerDetailsValues": row["offer_details_values"],
        "kbSpecification": row["kb_specification"],
        "parentDocumentId": row["parent_document_id"],
        "imageSlot": row["image_slot"],
        "uploadedAt": row["uploaded_at"].isoformat(),
        "updatedAt": row["updated_at"].isoformat(),
        "mailEmailId": row["mail_email_id"],
        "mailSubject": row["mail_subject"],
    }


async def list_documents() -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(_LIST_SQL)
    return [_row_to_dict(row) for row in rows]


async def create_document(
    file_name: str,
    file_kind: str | None,
    extraction_summary: str | None,
    parent_document_id: int | None = None,
    image_slot: int = 1,
) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO documents (file_name, file_kind, extraction_summary, parent_document_id, image_slot)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, file_name, file_kind, extraction_summary, norm, customer_name,
                  customer_number, price_per_stk, annual_quantity, status, firma_info,
                  calculation_data, offer_details_rows, offer_details_values, kb_specification,
                  parent_document_id, image_slot, uploaded_at, updated_at,
                  NULL::bigint AS mail_email_id, NULL::text AS mail_subject
        """,
        file_name,
        file_kind,
        extraction_summary,
        parent_document_id,
        image_slot,
    )
    return _row_to_dict(row)


# Calculation's Save button — updates the pricing/offer/firma data on an
# existing document (any single image row, parent or child). `document_id`
# may not exist yet (e.g. Save clicked before any successful upload in this
# session), in which case a fresh document is created instead of failing.
async def update_document(document_id: int, fields: dict) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE documents SET
            norm = $2, customer_name = $3, customer_number = $4,
            price_per_stk = $5, annual_quantity = $6,
            firma_info = $7, calculation_data = $8, offer_details_rows = $9,
            offer_details_values = $10,
            kb_specification = COALESCE($11, kb_specification),
            updated_at = now()
        WHERE id = $1
        RETURNING id
        """,
        document_id,
        fields.get("norm") or "—",
        fields.get("customerName") or "—",
        fields.get("customerNumber") or "—",
        fields.get("pricePerStk") or 0,
        fields.get("annualQuantity") or 0,
        fields.get("firmaInfo") or {},
        fields.get("calculationData"),
        fields.get("offerDetailsRows"),
        fields.get("offerDetailsValues"),
        # COALESCE keeps whatever was already stored when this update call
        # doesn't know about a specification (e.g. an older/unrelated PATCH)
        # — never silently wipes a previously-resolved lookup the way a
        # bare overwrite would.
        fields.get("kbSpecification"),
    )
    if row is None:
        created = await create_document(
            fields.get("fileName") or "Untitled",
            fields.get("fileKind"),
            fields.get("extractionSummary"),
            fields.get("parentDocumentId"),
            fields.get("imageSlot") or 1,
        )
        return await update_document(created["id"], fields)

    return await get_document(document_id)


# Narrow, standalone write path used right after extraction (before the
# user has ever clicked Save) to persist the Standards-KB lookup result the
# moment it resolves — see Documents.jsx's kbLookup.js. Deliberately touches
# ONLY this one column: unlike update_document (Save), which rewrites norm/
# customerName/calculationData/etc. together as one full snapshot, this
# must never reset any of those to their unset defaults just because a KB
# lookup happened to resolve before/after a real Save — regardless of which
# order those two things happen in for a given document.
async def set_kb_specification(document_id: int, kb_specification: dict | None) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        "UPDATE documents SET kb_specification = $2, updated_at = now() WHERE id = $1 RETURNING id",
        document_id,
        kb_specification,
    )
    if row is None:
        return None
    return await get_document(document_id)


async def get_document(document_id: int) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(_GET_BY_ID_SQL, document_id)
    return _row_to_dict(row) if row else None


# Powers "Open in Workspace": resolves a possibly-child id to its parent,
# then returns the parent plus every child image ordered by slot, so the
# frontend can rebuild the full 1-4 image workspace state in one call.
async def get_document_with_images(document_id: int) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(_GET_BY_ID_SQL, document_id)
    if row is None:
        return None

    parent_id = row["parent_document_id"] or row["id"]
    if row["parent_document_id"] is not None:
        row = await pool.fetchrow(_GET_BY_ID_SQL, parent_id)

    parent = _row_to_dict(row)
    child_rows = await pool.fetch(_GET_CHILDREN_SQL, parent_id)
    images = [parent] + [_row_to_dict(child) for child in child_rows]
    return {**parent, "images": images}


async def update_status(document_id: int, status: str) -> dict | None:
    pool = await get_pool()
    await pool.execute("UPDATE documents SET status = $2, updated_at = now() WHERE id = $1", document_id, status)
    return await get_document(document_id)


async def delete_document(document_id: int) -> bool:
    pool = await get_pool()
    result = await pool.execute("DELETE FROM documents WHERE id = $1", document_id)
    return result != "DELETE 0"
