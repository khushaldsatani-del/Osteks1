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
