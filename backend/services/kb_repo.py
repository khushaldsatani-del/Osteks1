import re
from decimal import Decimal, InvalidOperation

from services.db import get_pool
from services.kb_extraction import normalize_document_number

_ENTITY_KEYS = [
    "requirements",
    "parameters",
    "tables",
    "chemicals",
    "exceptions",
    "notes",
    "applications",
    "materials",
    "test_procedures",
]


def _dec(value) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _dedupe_by_key(rows: list[dict], key: str) -> list[dict]:
    seen = set()
    result = []
    for row in rows:
        value = row.get(key)
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(row)
    return result


async def find_duplicate(normalized_document_number: str, edition: str) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id, original_document_number, title, edition, uploaded_at FROM kb_documents "
        "WHERE normalized_document_number = $1 AND edition = $2",
        normalized_document_number,
        edition or "",
    )
    return dict(row) if row else None


# Persists one already-extracted bundle (see kb_extraction.py's
# extract_document) in a single transaction: the document row, then every
# child table, resolving variant_number/section_number references to real
# foreign keys as it goes. Also resolves document-to-document relationships
# in both directions — this new document's own outbound references get
# linked to any already-uploaded target immediately, and any *existing*
# relationship elsewhere in the KB that was waiting for this exact document
# number gets linked back to it now, regardless of which was uploaded first.
async def create_document(bundle: dict) -> dict:
    document = bundle["document"]
    meta = bundle["meta"]
    edition = document.get("edition") or ""
    normalized = document.get("normalized_document_number") or normalize_document_number(document.get("base_document_number", ""))

    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            doc_row = await conn.fetchrow(
                """
                INSERT INTO kb_documents (
                    original_document_number, base_document_number, normalized_document_number,
                    edition, revision, classification_number, title, document_type, language,
                    purpose, scope, source_file, source_file_hash, page_count, raw_text
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                RETURNING id, uploaded_at
                """,
                document.get("original_document_number"),
                document.get("base_document_number"),
                normalized,
                edition,
                document.get("revision"),
                document.get("classification_number"),
                document.get("title"),
                document.get("document_type"),
                document.get("language"),
                document.get("purpose"),
                document.get("scope"),
                meta.get("source_file"),
                meta.get("source_file_hash"),
                meta.get("page_count"),
                meta.get("raw_text"),
            )
            document_id = doc_row["id"]

            # Sections: insert flat first (no parent link yet — a child can
            # be extracted before its parent in the outline list), then a
            # second pass wires up parent_section_id once every section's
            # own id is known.
            section_id_by_number: dict[str, int] = {}
            sections = _dedupe_by_key(bundle.get("sections") or [], "section_number")
            for order_index, section in enumerate(sections):
                row = await conn.fetchrow(
                    """
                    INSERT INTO kb_document_sections (document_id, section_number, section_title, content, page_number, order_index)
                    VALUES ($1,$2,$3,$4,$5,$6)
                    RETURNING id
                    """,
                    document_id,
                    section["section_number"],
                    section.get("section_title"),
                    section.get("content"),
                    section.get("start_page"),
                    order_index,
                )
                section_id_by_number[section["section_number"]] = row["id"]

            for section in sections:
                parent_number = section.get("parent_section_number")
                if not parent_number or parent_number not in section_id_by_number:
                    continue
                await conn.execute(
                    "UPDATE kb_document_sections SET parent_section_id = $1 WHERE id = $2",
                    section_id_by_number[parent_number],
                    section_id_by_number[section["section_number"]],
                )

            # Variants.
            variant_id_by_number: dict[str, int] = {}
            variants = _dedupe_by_key(bundle.get("variants") or [], "variant_number")
            for variant in variants:
                row = await conn.fetchrow(
                    """
                    INSERT INTO kb_document_variants (
                        document_id, variant_number, corrosivity, iso_correspondence, climate_sequence,
                        corrosive_medium, application, vehicle_area, spraying_method, spray_distance,
                        frequency, special_conditions, control_plate_requirements, notes, attributes
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                    RETURNING id
                    """,
                    document_id,
                    variant["variant_number"],
                    variant.get("corrosivity"),
                    variant.get("iso_correspondence"),
                    variant.get("climate_sequence"),
                    variant.get("corrosive_medium"),
                    variant.get("application"),
                    variant.get("vehicle_area"),
                    variant.get("spraying_method"),
                    variant.get("spray_distance"),
                    variant.get("frequency"),
                    variant.get("special_conditions"),
                    variant.get("control_plate_requirements"),
                    variant.get("notes"),
                    {"page_number": variant.get("page_number")} if variant.get("page_number") is not None else None,
                )
                variant_id_by_number[variant["variant_number"]] = row["id"]

            def resolve_variant(item: dict) -> int | None:
                return variant_id_by_number.get(item.get("variant_number"))

            def resolve_section(item: dict) -> int | None:
                return section_id_by_number.get(item.get("section_number"))

            for item in bundle.get("requirements") or []:
                await conn.execute(
                    """
                    INSERT INTO kb_requirements (
                        document_id, section_id, variant_id, requirement_type, value_text, value_numeric,
                        unit, tolerance, tolerance_value, condition, additional_info, page_number
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                    """,
                    document_id,
                    resolve_section(item),
                    resolve_variant(item),
                    item.get("requirement_type"),
                    item.get("value_text"),
                    _dec(item.get("value_numeric")),
                    item.get("unit"),
                    item.get("tolerance"),
                    _dec(item.get("tolerance_value")),
                    item.get("condition"),
                    item.get("additional_info"),
                    item.get("page_number"),
                )

            for item in bundle.get("parameters") or []:
                await conn.execute(
                    """
                    INSERT INTO kb_parameters (
                        document_id, section_id, variant_id, parameter_name, value_text, value_numeric,
                        min_value, max_value, nominal_value, unit, tolerance, condition, time_label, page_number
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                    """,
                    document_id,
                    resolve_section(item),
                    resolve_variant(item),
                    item.get("parameter_name"),
                    item.get("value_text"),
                    _dec(item.get("value_numeric")),
                    _dec(item.get("min_value")),
                    _dec(item.get("max_value")),
                    _dec(item.get("nominal_value")),
                    item.get("unit"),
                    item.get("tolerance"),
                    item.get("condition"),
                    item.get("time_label"),
                    item.get("page_number"),
                )

            for item in bundle.get("tables") or []:
                await conn.execute(
                    """
                    INSERT INTO kb_tables (document_id, section_id, table_name, page_number, columns, rows)
                    VALUES ($1,$2,$3,$4,$5,$6)
                    """,
                    document_id,
                    resolve_section(item),
                    item.get("table_name"),
                    item.get("page_number"),
                    item.get("columns"),
                    item.get("rows"),
                )

            for item in bundle.get("chemicals") or []:
                await conn.execute(
                    """
                    INSERT INTO kb_chemicals (
                        document_id, section_id, variant_id, chemical_name, formula, quantity_value,
                        quantity_unit, concentration, purity, particle_size, material_grade, chemical_form,
                        context, notes, restrictions, page_number
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                    """,
                    document_id,
                    resolve_section(item),
                    resolve_variant(item),
                    item.get("chemical_name"),
                    item.get("formula"),
                    _dec(item.get("quantity_value")),
                    item.get("quantity_unit"),
                    item.get("concentration"),
                    item.get("purity"),
                    item.get("particle_size"),
                    item.get("material_grade"),
                    item.get("chemical_form"),
                    item.get("context"),
                    item.get("notes"),
                    item.get("restrictions"),
                    item.get("page_number"),
                )

            # requirement_id stays NULL here — the extraction schema doesn't
            # (yet) ask the model which specific requirement an exception
            # modifies, only which section/variant it belongs to. The
            # column exists for a future pass that does make that link
            # explicit, rather than a guess based on matching text.
            for item in bundle.get("exceptions") or []:
                await conn.execute(
                    """
                    INSERT INTO kb_exceptions (document_id, section_id, variant_id, statement, exception_type, page_number)
                    VALUES ($1,$2,$3,$4,$5,$6)
                    """,
                    document_id,
                    resolve_section(item),
                    resolve_variant(item),
                    item.get("statement"),
                    item.get("exception_type"),
                    item.get("page_number"),
                )

            for item in bundle.get("notes") or []:
                await conn.execute(
                    "INSERT INTO kb_notes (document_id, section_id, content, page_number) VALUES ($1,$2,$3,$4)",
                    document_id,
                    resolve_section(item),
                    item.get("content"),
                    item.get("page_number"),
                )

            for item in bundle.get("applications") or []:
                await conn.execute(
                    """
                    INSERT INTO kb_applications (document_id, section_id, variant_id, application_area, condition, notes)
                    VALUES ($1,$2,$3,$4,$5,$6)
                    """,
                    document_id,
                    resolve_section(item),
                    resolve_variant(item),
                    item.get("application_area"),
                    item.get("condition"),
                    item.get("notes"),
                )

            for item in bundle.get("materials") or []:
                await conn.execute(
                    """
                    INSERT INTO kb_materials (document_id, section_id, variant_id, material_name, material_grade, context, notes)
                    VALUES ($1,$2,$3,$4,$5,$6,$7)
                    """,
                    document_id,
                    resolve_section(item),
                    resolve_variant(item),
                    item.get("material_name"),
                    item.get("material_grade"),
                    item.get("context"),
                    item.get("notes"),
                )

            for item in bundle.get("test_procedures") or []:
                await conn.execute(
                    """
                    INSERT INTO kb_test_procedures (
                        document_id, section_id, variant_id, procedure_name, step_order, step_description,
                        duration, duration_unit, conditions, page_number
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                    """,
                    document_id,
                    resolve_section(item),
                    resolve_variant(item),
                    item.get("procedure_name"),
                    item.get("step_order") or 0,
                    item.get("step_description"),
                    item.get("duration"),
                    item.get("duration_unit"),
                    item.get("conditions"),
                    item.get("page_number"),
                )

            # This document's own outbound relationships — resolve against
            # any target that's already in the KB.
            for rel in bundle.get("relationships") or []:
                target_number = rel.get("target_document_number") or ""
                normalized_target = normalize_document_number(target_number)
                resolved = await conn.fetchval(
                    "SELECT id FROM kb_documents WHERE normalized_document_number = $1 ORDER BY edition DESC LIMIT 1",
                    normalized_target,
                )
                await conn.execute(
                    """
                    INSERT INTO kb_document_relationships (
                        source_document_id, target_document_number, normalized_target_document_number,
                        resolved_target_document_id, relationship_type, context, section_id
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
                    """,
                    document_id,
                    target_number,
                    normalized_target,
                    resolved,
                    rel.get("relationship_type") or "references",
                    rel.get("context"),
                    resolve_section(rel),
                )

            # Any *existing* relationship elsewhere in the KB that names
            # this document (by normalized number) and hasn't been resolved
            # yet gets linked to it now — this is what makes upload order
            # not matter (see kb_document_relationships' own comment).
            await conn.execute(
                """
                UPDATE kb_document_relationships
                SET resolved_target_document_id = $1
                WHERE normalized_target_document_number = $2 AND resolved_target_document_id IS NULL
                """,
                document_id,
                normalized,
            )

    return await get_document_summary(document_id)


async def get_document_summary(document_id: int) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, original_document_number, base_document_number, normalized_document_number,
               edition, title, classification_number, document_type, page_count, uploaded_at
        FROM kb_documents WHERE id = $1
        """,
        document_id,
    )
    return dict(row) if row else None


async def list_documents() -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, original_document_number, base_document_number, normalized_document_number,
               edition, title, classification_number, document_type, page_count, uploaded_at
        FROM kb_documents ORDER BY uploaded_at DESC
        """
    )
    return [dict(row) for row in rows]


async def _fetch_children(conn, table: str, document_id: int, order_by: str = "id") -> list[dict]:
    rows = await conn.fetch(f"SELECT * FROM {table} WHERE document_id = $1 ORDER BY {order_by}", document_id)
    return [dict(row) for row in rows]


# Returns one document's complete structured bundle — every child table,
# for the "search VW 96380, see everything" test view.
async def get_document_full(document_id: int) -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        doc_row = await conn.fetchrow("SELECT * FROM kb_documents WHERE id = $1", document_id)
        if not doc_row:
            return None

        sections = await _fetch_children(conn, "kb_document_sections", document_id, "order_index")
        variants = await _fetch_children(conn, "kb_document_variants", document_id, "variant_number")
        relationships = await conn.fetch(
            """
            SELECT r.*, d.original_document_number AS resolved_document_number
            FROM kb_document_relationships r
            LEFT JOIN kb_documents d ON d.id = r.resolved_target_document_id
            WHERE r.source_document_id = $1
            ORDER BY r.id
            """,
            document_id,
        )
        inbound_relationships = await conn.fetch(
            """
            SELECT r.*, d.original_document_number AS source_document_number
            FROM kb_document_relationships r
            JOIN kb_documents d ON d.id = r.source_document_id
            WHERE r.resolved_target_document_id = $1
            ORDER BY r.id
            """,
            document_id,
        )

        bundle = {
            "document": dict(doc_row),
            "sections": sections,
            "variants": variants,
            "relationships": [dict(row) for row in relationships],
            "inbound_relationships": [dict(row) for row in inbound_relationships],
        }
        for key, table in [
            ("requirements", "kb_requirements"),
            ("parameters", "kb_parameters"),
            ("tables", "kb_tables"),
            ("chemicals", "kb_chemicals"),
            ("exceptions", "kb_exceptions"),
            ("notes", "kb_notes"),
            ("applications", "kb_applications"),
            ("materials", "kb_materials"),
            ("test_procedures", "kb_test_procedures"),
        ]:
            bundle[key] = await _fetch_children(conn, table, document_id)
        return bundle


# Primary retrieval path: normalize the query and match
# normalized_document_number exactly (every edition, newest first). Only
# falls back to ILIKE over title/raw_text when there's no structured match
# at all — the structured key is always tried first.
_DOCUMENT_COLUMNS = (
    "id, original_document_number, base_document_number, normalized_document_number, "
    "edition, title, classification_number, document_type, page_count, uploaded_at"
)


async def search_documents(query: str) -> list[dict]:
    pool = await get_pool()
    normalized = normalize_document_number(query)

    # 1. Exact match on the document's own normalized number — "VW 96380",
    # "vw96380", "VW-96380" all resolve here.
    if normalized:
        rows = await pool.fetch(
            f"SELECT {_DOCUMENT_COLUMNS} FROM kb_documents WHERE normalized_document_number = $1 ORDER BY edition DESC",
            normalized,
        )
        if rows:
            return [dict(row) for row in rows]

    # 2. A code the query names isn't itself a document number — it's a
    # value recorded INSIDE a document (e.g. a coating code like "Ofl-639"
    # from VW 13750's Table 2, stored as requirement_type=
    # "surface_treatment_code" with value_text="x639"). Strip a leading
    # "Ofl"/"Ofl-" prefix (not part of the stored code) and match against
    # every requirement's value_text, returning the parent document(s).
    code_query = re.sub(r"(?i)^ofl[\s\-_]*", "", query.strip())
    if code_query:
        rows = await pool.fetch(
            f"""
            SELECT DISTINCT {", ".join(f"d.{c.strip()}" for c in _DOCUMENT_COLUMNS.split(","))}
            FROM kb_requirements r JOIN kb_documents d ON d.id = r.document_id
            WHERE r.value_text ILIKE $1
            ORDER BY d.uploaded_at DESC
            LIMIT 25
            """,
            f"%{code_query}%",
        )
        if rows:
            return [dict(row) for row in rows]

    # 3. General full-text fallback over document-level fields — always
    # secondary to the structured lookups above.
    like_term = f"%{query}%"
    rows = await pool.fetch(
        f"""
        SELECT {_DOCUMENT_COLUMNS} FROM kb_documents
        WHERE title ILIKE $1 OR raw_text ILIKE $1 OR original_document_number ILIKE $1
        ORDER BY uploaded_at DESC
        LIMIT 25
        """,
        like_term,
    )
    return [dict(row) for row in rows]


# --- Condensed lookup for the main app's auto-detected norm/spec text -----
# Consumed by GET /api/kb/lookup (main.py), which the image/email extraction
# workflow calls with whatever free text it read off a drawing/email as
# "Surface Treatment" (e.g. "VW 13750 - Ofl-x633 TL227"). Deliberately
# returns only the handful of facts that matter for a coating-cost quote —
# never the full KB record search_documents()/get_document_full() above
# serve the Standards DB test page with.

# All Ofl-xxx style codes stored in this KB are one letter followed by
# exactly 3 digits (a100, b111, t647, x639, z305, ...) — see kb_repo's own
# code-search tier above for the same convention. The separator between
# "Ofl" and the code varies a lot by drawing/OCR read — dash, underscore,
# space, a period (e.g. "Ofl.- X633", seen on a real drawing), or any mix
# of those — so the character class covers all of them rather than just
# the dash/underscore/space this originally shipped with.
_OFL_CODE_RE = re.compile(r"(?i)\bofl[\s\-_.]*([a-z]\d{3})\b")


async def lookup_specification(text: str) -> dict | None:
    if not text or not text.strip():
        return None

    pool = await get_pool()
    match = _OFL_CODE_RE.search(text)
    code = match.group(1).lower() if match else None

    if code:
        rows = await pool.fetch(
            """
            SELECT d.id, d.original_document_number, d.base_document_number, d.edition, r.condition
            FROM kb_requirements r JOIN kb_documents d ON d.id = r.document_id
            WHERE r.requirement_type = 'surface_treatment_code' AND r.value_text = $1
            ORDER BY d.id
            """,
            code,
        )
        if rows:
            # VW 13750 is the "family" document — where the code is
            # *defined* — so its condition text is the plain-language
            # meaning; every other document that also lists this code is
            # where its actual numeric test requirements live (e.g. TL 227,
            # TL 260). VW 13750 itself can have more than one edition in the
            # KB (each carrying the same code), so "other documents" must
            # exclude every VW 13750 row, not just the one picked for
            # meaning_row — comparing by base_document_number, not id,
            # is what makes that exclusion correct.
            vw13750_rows = [r for r in rows if r["base_document_number"] == "VW 13750"]
            meaning_row = max(vw13750_rows, key=lambda r: r["edition"] or "") if vw13750_rows else rows[0]
            other_docs = [r for r in rows if r["base_document_number"] != "VW 13750"]

            detail_rows = []
            if other_docs:
                doc_ids = [r["id"] for r in other_docs]
                detail_rows = await pool.fetch(
                    """
                    SELECT d.original_document_number, r.requirement_type, r.value_text, r.unit, r.condition
                    FROM kb_requirements r JOIN kb_documents d ON d.id = r.document_id
                    WHERE r.document_id = ANY($1::bigint[])
                      AND r.requirement_type != 'surface_treatment_code'
                      AND r.condition ILIKE $2
                    ORDER BY r.id
                    """,
                    doc_ids,
                    f"%{code}%",
                )

            thickness = None
            key_facts = []
            for row in detail_rows:
                if row["requirement_type"] == "coating_thickness_range" and thickness is None:
                    numbers = re.findall(r"\d+[.,]?\d*", row["value_text"] or "")
                    if len(numbers) >= 2:
                        lo = float(numbers[0].replace(",", "."))
                        hi = float(numbers[1].replace(",", "."))
                        thickness = {"min": lo, "max": hi, "mid": round((lo + hi) / 2, 1), "unit": row["unit"] or "µm"}
                key_facts.append(
                    {
                        "label": row["requirement_type"],
                        "value": row["value_text"],
                        "unit": row["unit"],
                        "detail": row["condition"],
                        "document": row["original_document_number"],
                    }
                )

            return {
                "matched": True,
                "code": code,
                "queryText": text,
                "documentNumber": meaning_row["base_document_number"],
                "meaning": meaning_row["condition"],
                "governingDocument": other_docs[0]["original_document_number"] if other_docs else None,
                "thickness": thickness,
                "keyFacts": key_facts[:6],
            }

    # No Ofl-code found — fall back to a plain document-number match so a
    # norm text naming just "TL 227" (no embedded code) still resolves to
    # at least the document's identity, not nothing at all.
    normalized = normalize_document_number(text)
    if normalized:
        row = await pool.fetchrow(
            "SELECT original_document_number, base_document_number, title FROM kb_documents "
            "WHERE normalized_document_number = $1 ORDER BY edition DESC LIMIT 1",
            normalized,
        )
        if row:
            return {
                "matched": True,
                "code": None,
                "queryText": text,
                "documentNumber": row["base_document_number"],
                "meaning": row["title"],
                "governingDocument": row["original_document_number"],
                "thickness": None,
                "keyFacts": [],
            }

    return None


async def delete_document(document_id: int) -> bool:
    pool = await get_pool()
    result = await pool.execute("DELETE FROM kb_documents WHERE id = $1", document_id)
    return result != "DELETE 0"
