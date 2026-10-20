from services.db import get_pool

# Production View data - the daily "Auswertungen" workbook, imported via
# Production View > Upload (services/production_import.py parses it,
# production_repo.py reads and writes these tables). Same "own file, own
# init_*_schema()" pattern as eightd_reports_db.py.
#
# production_uploads - one row per uploaded file. An upload starts as a
#   'preview' (parsed, nothing written yet; the parsed values wait in
#   `parsed` so the commit doesn't need the file again), then becomes
#   'committed' (values written, `parsed` cleared) or 'discarded'.
#   `source` is 'manual' today; the later automatic daily feed will write
#   'auto' through the same code.
# production_metrics - one row per workbook row label ("Umsatz KTL",
#   "Auftragsbestand KTL", ...), keyed by a slug of the label.
# production_daily_values - long format: one value per (date, metric).
#   Every row of every monthly sheet lands here, so a new chart is a query,
#   not a schema change. Re-importing a day overwrites it (the latest file
#   wins); upload_id records which file last wrote the value.
#   is_carry_forward marks backlog days the workbook copied unchanged from
#   the previous day (weekends, holidays) - see carry_forward_days().
_PRODUCTION_SCHEMA = """
CREATE TABLE IF NOT EXISTS production_uploads (
    id BIGSERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'preview',
    summary JSONB NOT NULL DEFAULT '{}',
    parsed JSONB,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    committed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_production_uploads_uploaded_at ON production_uploads(uploaded_at);

CREATE TABLE IF NOT EXISTS production_metrics (
    key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS production_daily_values (
    day DATE NOT NULL,
    metric TEXT NOT NULL REFERENCES production_metrics(key),
    value NUMERIC(18,6) NOT NULL,
    is_carry_forward BOOLEAN NOT NULL DEFAULT false,
    upload_id BIGINT REFERENCES production_uploads(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (day, metric)
);
CREATE INDEX IF NOT EXISTS idx_production_daily_values_metric_day ON production_daily_values(metric, day);
"""


async def init_production_schema() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(_PRODUCTION_SCHEMA)
