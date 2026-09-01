from services.db import get_pool

# Standards/document knowledge base — completely separate schema from the
# existing documents/emails tables (see db.py). Nothing here is referenced
# by, or references, the existing app's tables directly; the one link to
# the main app is read-only, via kb_repo.lookup_specification() /
# main.py's GET /api/kb/lookup, which the Specification feature depends
# on. init_kb_schema() runs from main.py's lifespan on every startup
# (idempotent — CREATE TABLE IF NOT EXISTS). The standalone CLI that was
# used to build/manage this data (dump PDF text, hand-build a bundle,
# save/search/list/delete) has since been removed along with the
# browsing page it supported; the already-extracted data itself is
# untouched and keeps being served exactly as before.
#
# One row per document EDITION, not per base standard — "VW 96380:2015-07"
# and "VW 96380:2011-08" are different kb_documents rows, never merged.
# Everything else is FK'd to kb_documents (CASCADE), so deleting a document
# during testing cleans up every child row automatically.
_KB_SCHEMA = """
CREATE TABLE IF NOT EXISTS kb_documents (
    id BIGSERIAL PRIMARY KEY,
    original_document_number TEXT NOT NULL,
    base_document_number TEXT NOT NULL,
    normalized_document_number TEXT NOT NULL,
    edition TEXT NOT NULL DEFAULT '',
    revision TEXT,
    classification_number TEXT,
    title TEXT,
    document_type TEXT,
    language TEXT,
    purpose TEXT,
    scope TEXT,
    source_file TEXT NOT NULL,
    source_file_hash TEXT NOT NULL,
    page_count INTEGER,
    raw_text TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (normalized_document_number, edition)
);
CREATE INDEX IF NOT EXISTS idx_kb_documents_normalized ON kb_documents(normalized_document_number);
CREATE INDEX IF NOT EXISTS idx_kb_documents_source_hash ON kb_documents(source_file_hash);

CREATE TABLE IF NOT EXISTS kb_document_sections (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    section_number TEXT NOT NULL,
    parent_section_id BIGINT REFERENCES kb_document_sections(id) ON DELETE SET NULL,
    section_title TEXT,
    content TEXT,
    page_number INTEGER,
    order_index INTEGER NOT NULL DEFAULT 0,
    UNIQUE (document_id, section_number)
);
CREATE INDEX IF NOT EXISTS idx_kb_sections_document_id ON kb_document_sections(document_id);

CREATE TABLE IF NOT EXISTS kb_document_variants (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    variant_number TEXT NOT NULL,
    corrosivity TEXT,
    iso_correspondence TEXT,
    climate_sequence TEXT,
    corrosive_medium TEXT,
    application TEXT,
    vehicle_area TEXT,
    spraying_method TEXT,
    spray_distance TEXT,
    frequency TEXT,
    special_conditions TEXT,
    control_plate_requirements TEXT,
    notes TEXT,
    attributes JSONB,
    UNIQUE (document_id, variant_number)
);
CREATE INDEX IF NOT EXISTS idx_kb_variants_document_id ON kb_document_variants(document_id);

-- requirement_type/parameter_name are deliberately free-form text (not an
-- enum) — the range of technical facts a standard can state is open-ended,
-- and a fixed enum would force either lossy bucketing or constant schema
-- migrations. `attributes` JSONB is the escape hatch for anything that
-- doesn't fit the named columns, same pattern the existing app already
-- uses for documents.calculation_data/offer_details_values.
CREATE TABLE IF NOT EXISTS kb_requirements (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES kb_document_sections(id) ON DELETE SET NULL,
    variant_id BIGINT REFERENCES kb_document_variants(id) ON DELETE SET NULL,
    requirement_type TEXT,
    value_text TEXT,
    value_numeric NUMERIC,
    unit TEXT,
    tolerance TEXT,
    tolerance_value NUMERIC,
    condition TEXT,
    additional_info TEXT,
    page_number INTEGER,
    attributes JSONB
);
CREATE INDEX IF NOT EXISTS idx_kb_requirements_document_id ON kb_requirements(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_requirements_type ON kb_requirements(requirement_type);
CREATE INDEX IF NOT EXISTS idx_kb_requirements_variant_id ON kb_requirements(variant_id);

-- Climate/time-series data lives here too — a chart point is structurally
-- just a parameter with a time_label ("09:00") and a condition ("section
-- A"), not a separate wide time-series table.
CREATE TABLE IF NOT EXISTS kb_parameters (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES kb_document_sections(id) ON DELETE SET NULL,
    variant_id BIGINT REFERENCES kb_document_variants(id) ON DELETE SET NULL,
    parameter_name TEXT,
    value_text TEXT,
    value_numeric NUMERIC,
    min_value NUMERIC,
    max_value NUMERIC,
    nominal_value NUMERIC,
    unit TEXT,
    tolerance TEXT,
    condition TEXT,
    time_label TEXT,
    page_number INTEGER,
    attributes JSONB
);
CREATE INDEX IF NOT EXISTS idx_kb_parameters_document_id ON kb_parameters(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_parameters_name ON kb_parameters(parameter_name);

-- Preserves a table's exact printed shape (columns/rows as JSONB) instead
-- of flattening it — significant rows are ALSO mirrored into
-- kb_requirements/kb_parameters during extraction for fast typed queries,
-- so full fidelity and fast lookup both exist side by side.
CREATE TABLE IF NOT EXISTS kb_tables (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES kb_document_sections(id) ON DELETE SET NULL,
    table_name TEXT,
    page_number INTEGER,
    columns JSONB,
    rows JSONB
);
CREATE INDEX IF NOT EXISTS idx_kb_tables_document_id ON kb_tables(document_id);

CREATE TABLE IF NOT EXISTS kb_chemicals (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES kb_document_sections(id) ON DELETE SET NULL,
    variant_id BIGINT REFERENCES kb_document_variants(id) ON DELETE SET NULL,
    chemical_name TEXT,
    formula TEXT,
    quantity_value NUMERIC,
    quantity_unit TEXT,
    concentration TEXT,
    purity TEXT,
    particle_size TEXT,
    material_grade TEXT,
    chemical_form TEXT,
    context TEXT,
    notes TEXT,
    restrictions TEXT,
    page_number INTEGER
);
CREATE INDEX IF NOT EXISTS idx_kb_chemicals_document_id ON kb_chemicals(document_id);

-- Merges "referenced documents" and "relationships between standards" —
-- both are the same shape: a directed, typed edge between two documents.
-- resolved_target_document_id starts NULL (target not uploaded yet) and is
-- filled in automatically — by kb_repo.py — whenever a document matching
-- normalized_target_document_number is uploaded, in either order.
-- "available in database" is this column being non-null: derived, never a
-- separately-stored flag that could go stale.
CREATE TABLE IF NOT EXISTS kb_document_relationships (
    id BIGSERIAL PRIMARY KEY,
    source_document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    target_document_number TEXT NOT NULL,
    normalized_target_document_number TEXT NOT NULL,
    resolved_target_document_id BIGINT REFERENCES kb_documents(id) ON DELETE SET NULL,
    relationship_type TEXT NOT NULL DEFAULT 'references',
    context TEXT,
    section_id BIGINT REFERENCES kb_document_sections(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_kb_relationships_source ON kb_document_relationships(source_document_id);
CREATE INDEX IF NOT EXISTS idx_kb_relationships_target_norm ON kb_document_relationships(normalized_target_document_number);
CREATE INDEX IF NOT EXISTS idx_kb_relationships_resolved ON kb_document_relationships(resolved_target_document_id);

CREATE TABLE IF NOT EXISTS kb_exceptions (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES kb_document_sections(id) ON DELETE SET NULL,
    variant_id BIGINT REFERENCES kb_document_variants(id) ON DELETE SET NULL,
    requirement_id BIGINT REFERENCES kb_requirements(id) ON DELETE SET NULL,
    statement TEXT NOT NULL,
    exception_type TEXT,
    page_number INTEGER
);
CREATE INDEX IF NOT EXISTS idx_kb_exceptions_document_id ON kb_exceptions(document_id);

CREATE TABLE IF NOT EXISTS kb_notes (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES kb_document_sections(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    page_number INTEGER
);
CREATE INDEX IF NOT EXISTS idx_kb_notes_document_id ON kb_notes(document_id);

CREATE TABLE IF NOT EXISTS kb_applications (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES kb_document_sections(id) ON DELETE SET NULL,
    variant_id BIGINT REFERENCES kb_document_variants(id) ON DELETE SET NULL,
    application_area TEXT NOT NULL,
    condition TEXT,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_kb_applications_document_id ON kb_applications(document_id);

CREATE TABLE IF NOT EXISTS kb_materials (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES kb_document_sections(id) ON DELETE SET NULL,
    variant_id BIGINT REFERENCES kb_document_variants(id) ON DELETE SET NULL,
    material_name TEXT NOT NULL,
    material_grade TEXT,
    context TEXT,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_kb_materials_document_id ON kb_materials(document_id);

CREATE TABLE IF NOT EXISTS kb_test_procedures (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES kb_document_sections(id) ON DELETE SET NULL,
    variant_id BIGINT REFERENCES kb_document_variants(id) ON DELETE SET NULL,
    procedure_name TEXT,
    step_order INTEGER NOT NULL DEFAULT 0,
    step_description TEXT NOT NULL,
    duration TEXT,
    duration_unit TEXT,
    conditions TEXT,
    page_number INTEGER
);
CREATE INDEX IF NOT EXISTS idx_kb_test_procedures_document_id ON kb_test_procedures(document_id);
"""


async def init_kb_schema() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(_KB_SCHEMA)
