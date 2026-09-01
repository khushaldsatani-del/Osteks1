import json
import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg

_pool: asyncpg.Pool | None = None

_SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_kind TEXT,
    extraction_summary TEXT,
    norm TEXT NOT NULL DEFAULT '—',
    customer_name TEXT NOT NULL DEFAULT '—',
    customer_number TEXT NOT NULL DEFAULT '—',
    price_per_stk NUMERIC(12,2) NOT NULL DEFAULT 0,
    annual_quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    firma_info JSONB NOT NULL DEFAULT '{}',
    calculation_data JSONB,
    offer_details_rows JSONB,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_format TEXT NOT NULL,
    subject TEXT,
    sender TEXT,
    recipient TEXT,
    cc TEXT,
    email_date TIMESTAMPTZ,
    body_text TEXT,
    raw_file BYTEA NOT NULL,
    raw_mimetype TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_attachments (
    id BIGSERIAL PRIMARY KEY,
    email_id BIGINT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    content_type TEXT,
    file_size INTEGER,
    file_data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_document_id ON emails(document_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(email_id);

-- A document row can now be one of up to 4 independent images belonging to
-- the same offer (see main.py's MAX_IMAGE_SLOTS). The first-uploaded image
-- stays a normal top-level row (parent_document_id NULL, image_slot
-- defaults to 1) — every row that already existed before this column was
-- added is automatically a valid "1-image offer, slot 1" record with zero
-- backfill needed. Images 2/3/4 are separate rows referencing the first
-- one; deleting the parent cascades to its child images the same way it
-- already cascades to a linked email.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_document_id BIGINT REFERENCES documents(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS image_slot SMALLINT NOT NULL DEFAULT 1;
-- OfferDetails' own raw editable fields (Preis Verpackung, Prüfungen, Notes,
-- etc.), separate from offer_details_rows (the derived label/value pairs
-- already used for Document Preview) — needed so reopening a saved image's
-- Offer Details restores actual edited state, not just its display rows.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS offer_details_values JSONB;
CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON documents(parent_document_id);
-- Condensed Standards-KB lookup result for this document's auto-detected
-- norm/spec text (see services/kb_repo.py's lookup_specification) — the
-- handful of cost-relevant facts (what the code means, its governing TL,
-- coating thickness range, key severity numbers), never the full KB
-- record. NULL when nothing was detected/matched, exactly like every
-- other nullable extraction-derived column here. Purely additive: nothing
-- reads or writes this column unless it explicitly opts in.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS kb_specification JSONB;
"""


# Neon's connection string carries libpq-style query params (sslmode,
# channel_binding) that asyncpg's own DSN parser doesn't understand — strip
# them and pass the SSL requirement explicitly via connect() instead.
def _sanitize_dsn(dsn: str) -> str:
    parts = urlsplit(dsn)
    query = dict(parse_qsl(parts.query))
    query.pop("sslmode", None)
    query.pop("channel_binding", None)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _dsn() -> str:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is not configured. Add it to backend/.env.")
    return dsn


# asyncpg hands back jsonb columns as raw text by default — this codec
# makes them round-trip as plain Python dicts/lists everywhere else in the
# backend, matching how every other column type already behaves.
async def _init_connection(conn: asyncpg.Connection) -> None:
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog", format="text"
    )


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(dsn=_sanitize_dsn(_dsn()), ssl="require", init=_init_connection)
    return _pool


async def init_db() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(_SCHEMA)


async def close_db() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
