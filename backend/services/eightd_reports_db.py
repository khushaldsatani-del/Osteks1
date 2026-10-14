from services.db import get_pool

# 8D Report records - their own table, same "own file, own init_*_schema()"
# pattern as test_reports_db.py. A row is written when an 8D report is
# downloaded (PDF or Word) from the wizard's View Report step, and updated
# on every later download of the same report.
#
# The wizard's whole state (General Information, 3D and 8D steps) lives in
# one JSONB column, wizard_state, which the frontend owns the shape of -
# same convention as test_reports.wizard_state. The handful of fields the
# 8D Report Overview lists and searches on are copied into their own columns
# so the list never has to unpack JSONB. complaint_date is TEXT, not DATE,
# because the wizard accepts a calendar week ("KW34") as well as a date.
_EIGHTD_REPORTS_SCHEMA = """
CREATE TABLE IF NOT EXISTS eightd_reports (
    id BIGSERIAL PRIMARY KEY,
    report_no TEXT NOT NULL DEFAULT '',
    customer_reference TEXT NOT NULL DEFAULT '',
    part_name TEXT NOT NULL DEFAULT '',
    customer TEXT NOT NULL DEFAULT '',
    complaint_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'created',
    wizard_state JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eightd_reports_updated_at ON eightd_reports(updated_at);
"""


async def init_eightd_reports_schema() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(_EIGHTD_REPORTS_SCHEMA)
