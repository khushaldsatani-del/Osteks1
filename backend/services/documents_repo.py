from services.db import get_pool

# Every row returned by this module is already shaped in camelCase, matching
# the JSON the frontend expects — callers in main.py can return these dicts
# directly as a response body with no further translation.
_LIST_SQL = """
SELECT
    d.id, d.file_name, d.file_kind, d.extraction_summary,
    d.norm, d.customer_name, d.customer_number,
    d.price_per_stk, d.annual_quantity, d.status,
    d.firma_info, d.calculation_data, d.offer_details_rows,
    d.uploaded_at, d.updated_at,
    e.id AS mail_email_id, e.subject AS mail_subject
FROM documents d
LEFT JOIN emails e ON e.document_id = d.id
ORDER BY d.uploaded_at DESC
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
        "uploadedAt": row["uploaded_at"].isoformat(),
        "updatedAt": row["updated_at"].isoformat(),
        "mailEmailId": row["mail_email_id"],
        "mailSubject": row["mail_subject"],
    }


async def list_documents() -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(_LIST_SQL)
    return [_row_to_dict(row) for row in rows]


async def create_document(file_name: str, file_kind: str | None, extraction_summary: str | None) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO documents (file_name, file_kind, extraction_summary)
        VALUES ($1, $2, $3)
        RETURNING id, file_name, file_kind, extraction_summary, norm, customer_name,
                  customer_number, price_per_stk, annual_quantity, status, firma_info,
                  calculation_data, offer_details_rows, uploaded_at, updated_at,
                  NULL::bigint AS mail_email_id, NULL::text AS mail_subject
        """,
        file_name,
        file_kind,
        extraction_summary,
    )
    return _row_to_dict(row)


# Calculation's Save button — updates the pricing/offer/firma data on an
# existing document. `document_id` may not exist yet (e.g. Save clicked
# before any successful upload in this session), in which case a fresh
# document is created instead of failing.
async def update_document(document_id: int, fields: dict) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE documents SET
            norm = $2, customer_name = $3, customer_number = $4,
            price_per_stk = $5, annual_quantity = $6,
            firma_info = $7, calculation_data = $8, offer_details_rows = $9,
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
    )
    if row is None:
        created = await create_document(
            fields.get("fileName") or "Untitled", fields.get("fileKind"), fields.get("extractionSummary")
        )
        return await update_document(created["id"], fields)

    return await get_document(document_id)


async def get_document(document_id: int) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(_LIST_SQL.replace("ORDER BY d.uploaded_at DESC", "WHERE d.id = $1"), document_id)
    return _row_to_dict(row) if row else None


async def update_status(document_id: int, status: str) -> dict | None:
    pool = await get_pool()
    await pool.execute("UPDATE documents SET status = $2, updated_at = now() WHERE id = $1", document_id, status)
    return await get_document(document_id)


async def delete_document(document_id: int) -> bool:
    pool = await get_pool()
    result = await pool.execute("DELETE FROM documents WHERE id = $1", document_id)
    return result != "DELETE 0"
