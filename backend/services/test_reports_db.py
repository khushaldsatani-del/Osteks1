from services.db import get_pool

# Test Report records — separate schema from documents/emails and from the
# Standards KB (kb_db.py), same "own file, own init_*_schema()" pattern as
# kb_db.py. document_id links back to the source offer/drawing a report was
# generated from (so norm/part context can flow in automatically) but is
# nullable — a report can also be started from scratch via the sidebar's
# "Generate Report" entry with no linked document, same as the existing
# mock Overview page already implies is possible.
#
# The wizard's entire wire-format state (Basic Information, Test
# Conditions, Results, Evaluation — everything TestReport.jsx currently
# only ever holds in useState) lives in one JSONB column, wizard_state,
# rather than being normalized into columns — this mirrors
# documents.calculation_data/offer_details_values' existing convention for
# "a big, evolving, mostly-opaque form blob the frontend owns the shape
# of." report_no/test_object/norm/test_date are pulled out as their own
# columns anyway because All Documents' sibling page (Test Report
# Overview) needs to list/sort/filter on them without unpacking JSONB on
# every request.
#
# Images referenced from within wizard_state are never stored here or in
# any BYTEA column — only their Google Cloud Storage object path (see
# gcs_storage.py). Keeps this table's own footprint tiny regardless of how
# many photos a report ends up with.
_TEST_REPORTS_SCHEMA = """
CREATE TABLE IF NOT EXISTS test_reports (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT REFERENCES documents(id) ON DELETE SET NULL,
    report_no TEXT NOT NULL DEFAULT '',
    test_object TEXT NOT NULL DEFAULT '',
    norm TEXT NOT NULL DEFAULT '',
    -- "pending" until the wizard's Save button actually succeeds at least
    -- once (see TestReport.jsx's handleSave, the only place this ever
    -- becomes "created") — drives the Overview page's status pill.
    status TEXT NOT NULL DEFAULT 'pending',
    wizard_state JSONB NOT NULL DEFAULT '{}',
    test_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_test_reports_document_id ON test_reports(document_id);
CREATE INDEX IF NOT EXISTS idx_test_reports_created_at ON test_reports(created_at);

-- One row per uploaded image, so cleanup (deleting an object in GCS when
-- a photo is replaced/removed, or cascading when the whole report is
-- deleted) never has to walk wizard_state's arbitrary JSON to find every
-- object_path that was ever handed out — it just deletes this table's
-- rows for the report and removes the matching GCS objects. `slot` is
-- whatever free-form key the frontend used when uploading (e.g.
-- "cycle5.before", "crosscut.corrosion.after") — purely descriptive,
-- never parsed server-side.
CREATE TABLE IF NOT EXISTS test_report_images (
    id BIGSERIAL PRIMARY KEY,
    test_report_id BIGINT NOT NULL REFERENCES test_reports(id) ON DELETE CASCADE,
    slot TEXT NOT NULL,
    object_path TEXT NOT NULL UNIQUE,
    content_type TEXT,
    file_size INTEGER,
    original_filename TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_test_report_images_report_id ON test_report_images(test_report_id);

-- Idempotent fixups for the "status" column's meaning changing from a
-- generic 'draft' to the pending/created pair the Overview page's status
-- pill now reads — CREATE TABLE's own DEFAULT above only applies to a
-- brand-new table, not one that already exists in a live database, and
-- any row inserted before this change is still sitting on the old
-- 'draft' value.
ALTER TABLE test_reports ALTER COLUMN status SET DEFAULT 'pending';
UPDATE test_reports SET status = 'pending' WHERE status = 'draft';
"""


async def init_test_reports_schema() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(_TEST_REPORTS_SCHEMA)
