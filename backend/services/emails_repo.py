from services.db import get_pool
from services.email_processing import strip_bare_link_artifacts


def _email_to_dict(row, attachments: list[dict]) -> dict:
    return {
        "id": row["id"],
        "documentId": row["document_id"],
        "fileName": row["file_name"],
        "fileFormat": row["file_format"],
        "subject": row["subject"],
        "from": row["sender"],
        "to": row["recipient"],
        "cc": row["cc"],
        "date": row["email_date"].isoformat() if row["email_date"] else None,
        "bodyText": strip_bare_link_artifacts(row["body_text"]),
        "attachments": attachments,
    }


def _attachment_to_dict(row) -> dict:
    return {"id": row["id"], "fileName": row["file_name"], "contentType": row["content_type"], "size": row["file_size"]}


# Requires an existing document (see main.py's /api/emails/upload) — an
# email is never stored without being linked to the technical file it
# belongs to. Inserts the email and every attachment in one transaction so
# a mid-batch failure can't leave a half-stored email behind.
async def create_email(
    document_id: int,
    file_name: str,
    file_format: str,
    parsed: dict,
    raw_bytes: bytes,
    raw_mimetype: str,
) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            email_row = await conn.fetchrow(
                """
                INSERT INTO emails (document_id, file_name, file_format, subject, sender, recipient, cc, email_date, body_text, raw_file, raw_mimetype)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id, document_id, file_name, file_format, subject, sender, recipient, cc, email_date, body_text
                """,
                document_id,
                file_name,
                file_format,
                parsed.get("subject") or "",
                parsed.get("from") or "",
                parsed.get("to") or "",
                parsed.get("cc") or "",
                parsed.get("date"),
                parsed.get("body_text") or "",
                raw_bytes,
                raw_mimetype,
            )

            attachment_rows = []
            for attachment in parsed.get("attachments", []):
                attachment_row = await conn.fetchrow(
                    """
                    INSERT INTO email_attachments (email_id, file_name, content_type, file_size, file_data)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id, file_name, content_type, file_size
                    """,
                    email_row["id"],
                    attachment["filename"],
                    attachment["content_type"],
                    attachment["size"],
                    attachment["buffer"],
                )
                attachment_rows.append(_attachment_to_dict(attachment_row))

    return _email_to_dict(email_row, attachment_rows)


async def get_email(email_id: int) -> dict | None:
    pool = await get_pool()
    email_row = await pool.fetchrow(
        "SELECT id, document_id, file_name, file_format, subject, sender, recipient, cc, email_date, body_text FROM emails WHERE id = $1",
        email_id,
    )
    if email_row is None:
        return None

    attachment_rows = await pool.fetch(
        "SELECT id, file_name, content_type, file_size FROM email_attachments WHERE email_id = $1 ORDER BY id",
        email_id,
    )
    return _email_to_dict(email_row, [_attachment_to_dict(row) for row in attachment_rows])


async def get_email_raw(email_id: int) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow("SELECT file_name, raw_mimetype, raw_file FROM emails WHERE id = $1", email_id)
    if row is None:
        return None
    return {"file_name": row["file_name"], "mimetype": row["raw_mimetype"], "data": row["raw_file"]}


async def get_attachment(attachment_id: int) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT file_name, content_type, file_data FROM email_attachments WHERE id = $1", attachment_id
    )
    if row is None:
        return None
    return {"file_name": row["file_name"], "content_type": row["content_type"], "data": row["file_data"]}


async def delete_email(email_id: int) -> bool:
    pool = await get_pool()
    result = await pool.execute("DELETE FROM emails WHERE id = $1", email_id)
    return result != "DELETE 0"
