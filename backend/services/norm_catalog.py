import hashlib
import json
import os
import re
import unicodedata

from services.db import get_pool

# Coating-norm catalogue for every customer that is NOT covered by the VW
# 13750 knowledge base in kb_* (BMW GS 90011, Porsche PN 11011, Daimler DBL
# nnnn.AA, MAN M 3018, EVO 132.21, Hyundai MS 630-01, Magna S100 012 00, ...).
#
# The data lives in backend/data/norm_catalog.json, which is generated from
# the customer PDFs (see that file's `built_from`) and is the reviewable
# source of truth. On startup it is copied into the norm_catalog table,
# but only when its content hash differs from the one recorded in
# norm_catalog_meta, so a normal restart touches nothing. Every read goes to
# the database first and falls back to the same JSON in memory if the
# database is unreachable or the table does not exist yet, so the lookup
# keeps answering whatever happens to the database.
#
# Nothing here touches the existing tables. kb_repo.lookup_specification()
# only consults this module after its own VW 13750 path has found nothing,
# so every VW result is exactly what it was before this module existed.

_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "norm_catalog.json")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS norm_catalog (
    id BIGSERIAL PRIMARY KEY,
    match_key TEXT NOT NULL UNIQUE,
    customer TEXT NOT NULL,
    system TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    designation TEXT NOT NULL,
    aliases TEXT[] NOT NULL DEFAULT '{}',
    meaning TEXT,
    thickness JSONB,
    facts JSONB NOT NULL DEFAULT '[]',
    source_document TEXT,
    coverage TEXT NOT NULL DEFAULT 'full',
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_norm_catalog_system ON norm_catalog(system);
CREATE TABLE IF NOT EXISTS norm_catalog_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

# Serialises the sync across Cloud Run instances that start at the same time.
_SYNC_LOCK_ID = 739_104_2211

# The wizard's "Test Duration (Cycles)" dropdown (testReportConstants.js'
# CYCLE_DURATIONS) models the VW PV 1210 cycle. Only a fact labelled
# cyclic_corrosion_cycles is ever fed into it, and the catalogue only uses
# that label for tests with the same 4 h / 4 h / 16 h cycle (Magna
# KWT-4/4/16). Every other customer's cyclic test (BMW AA-0224, Daimler KWT,
# DIN 55635, VDA 621-415, PPV 4017, SAE J2334 ...) is a different test, so it
# is labelled corrosion_test_cycles and never pre-fills the wizard.
WIZARD_CYCLES = (5, 15, 30, 60, 120, 240)

_cache: dict | None = None


def _load_file() -> dict:
    global _cache
    if _cache is None:
        with open(_DATA_PATH, "rb") as handle:
            raw = handle.read()
        payload = json.loads(raw.decode("utf-8"))
        payload["digest"] = hashlib.sha256(raw).hexdigest()
        _cache = payload
    return _cache


def key(*parts: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", "".join(parts).upper())


def _clean(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    return re.sub("[­​-‍⁠﻿]", "", text)


# --- database -------------------------------------------------------------

async def init_and_sync() -> str:
    """Create the tables if needed and load the JSON when it has changed.
    Returns what happened; never raises (startup must not depend on it)."""
    try:
        payload = _load_file()
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(_SCHEMA)
            async with conn.transaction():
                await conn.execute("SELECT pg_advisory_xact_lock($1)", _SYNC_LOCK_ID)
                current = await conn.fetchval("SELECT value FROM norm_catalog_meta WHERE key = 'data_hash'")
                if current == payload["digest"]:
                    return "unchanged"
                await conn.execute("DELETE FROM norm_catalog")
                await conn.executemany(
                    """
                    INSERT INTO norm_catalog (match_key, customer, system, code, designation, aliases,
                                              meaning, thickness, facts, source_document, coverage, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    """,
                    [
                        (
                            e["match_key"], e["customer"], e["system"], e["code"], e["designation"], e["aliases"],
                            e["meaning"], e["thickness"], e["facts"], e["source_document"], e["coverage"], e["notes"],
                        )
                        for e in payload["entries"]
                    ],
                )
                await conn.execute(
                    """
                    INSERT INTO norm_catalog_meta (key, value, updated_at) VALUES ('data_hash', $1, now())
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
                    """,
                    payload["digest"],
                )
        return f"loaded {len(payload['entries'])} entries"
    except Exception as error:  # noqa: BLE001 - reported, never fatal
        print("norm_catalog sync skipped:", repr(error))
        return f"skipped: {error!r}"


_COLUMNS = "match_key, customer, system, code, designation, aliases, meaning, thickness, facts, source_document, coverage, notes"


def _row(record) -> dict:
    row = dict(record)
    row["aliases"] = list(row.get("aliases") or [])
    for field in ("thickness", "facts"):
        if isinstance(row.get(field), str):
            row[field] = json.loads(row[field])
    return row


async def all_entries() -> list[dict]:
    try:
        pool = await get_pool()
        rows = await pool.fetch(f"SELECT {_COLUMNS} FROM norm_catalog ORDER BY customer, system, id")
        if rows:
            return [_row(r) for r in rows]
    except Exception as error:  # noqa: BLE001
        print("norm_catalog read from database failed, using file:", repr(error))
    return [dict(e) for e in _load_file()["entries"]]


async def _entries_by_keys(keys: list[str]) -> list[dict]:
    if not keys:
        return []
    try:
        pool = await get_pool()
        rows = await pool.fetch(
            f"SELECT {_COLUMNS} FROM norm_catalog WHERE match_key = ANY($1::text[]) OR aliases && $1::text[]",
            keys,
        )
        if rows:
            return [_row(r) for r in rows]
        # An empty table (e.g. sync not run yet) is not an answer - fall through.
        if await pool.fetchval("SELECT count(*) FROM norm_catalog"):
            return []
    except Exception as error:  # noqa: BLE001
        print("norm_catalog lookup in database failed, using file:", repr(error))
    wanted = set(keys)
    return [dict(e) for e in _load_file()["entries"] if e["match_key"] in wanted or wanted & set(e["aliases"])]


# --- reading a norm out of free text -------------------------------------
#
# Each parser recognises one customer's designation however the drawing,
# OCR or AI happened to punctuate it, and returns (system, code) pairs in
# the catalogue's own spelling. Codes that the catalogue does not know are
# simply not found - nothing is ever guessed.

_SEP = r"[\s\-_.,:;/–—]*"


def _find_all(pattern, text, build):
    out = []
    for m in re.finditer(pattern, text, re.IGNORECASE):
        pair = build(m)
        if pair and pair not in out:
            out.append(pair)
    return out


def _magna(text):
    pairs = []
    for m in re.finditer(
        r"S\s*100\s*012\s*00" + _SEP + r"Ofl" + _SEP + r"KTL\s*(?:\(\s*[a-z]{2}\s*\))?" + _SEP
        + r"([LMH])\s*(\d{2,4})\s*(h|c)\s*(s?)(?:\s*/\s*(\d{1,3})\s*(c)\s*(s?))?",
        text, re.IGNORECASE,
    ):
        cls, n1, u1, s1, n2, u2, s2 = m.groups()
        code = f"{cls.upper()}{n1}{u1.lower()}{s1.lower()}"
        if n2:
            code += f"/{n2}{u2.lower()}{s2.lower()}"
        pairs.append(("S100 012 00", f"Ofl-KTL(sw)-{code}"))
    return pairs


def _near(anchor, pattern, text, system, build):
    if not re.search(anchor, text, re.IGNORECASE):
        return []
    return _find_all(pattern, text, lambda m: (system, build(m)))


def parse(text: str) -> list[tuple[str, str]]:
    """All (system, code) pairs a text names, most specific first."""
    t = _clean(text)
    pairs: list[tuple[str, str]] = []

    def extend(items):
        for item in items:
            if item not in pairs:
                pairs.append(item)

    extend(_find_all(r"\bGS" + _SEP + r"90011" + _SEP + r"LA" + _SEP + r"([A-Z]{2})" + _SEP + r"([0-3])(?![0-9])", t,
                     lambda m: ("GS 90011", f"LA {m[1].upper()} {m[2]}")))
    extend(_find_all(r"\bPN" + _SEP + r"11011" + _SEP + r"([a-z0-9]{4})(?![a-z0-9])", t,
                     lambda m: ("PN 11011", m[1])))
    extend(_magna(t))
    extend(_find_all(r"\bDBL" + _SEP + r"(\d{4})\s*[.,]\s*(\d{2})(?![0-9])", t,
                     lambda m: (f"DBL {m[1]}", m[2])))
    extend(_find_all(r"(?<![A-Za-z0-9])M" + _SEP + r"3018\s*[-–—]\s*(K1|K2|[1-4]|T)(?![A-Za-z0-9])", t,
                     lambda m: ("M 3018", m[1].upper())))
    extend(_find_all(r"\bEVO" + _SEP + r"132\s*[.,]\s*21\s*[-–—]\s*(\d{2})(?![0-9])", t,
                     lambda m: ("EVO 132.21", m[1])))
    extend(_find_all(r"\bEVO" + _SEP + r"132\s*[.,]\s*22\s*[-–—]\s*([A-Z])(?![A-Za-z0-9])", t,
                     lambda m: ("EVO 132.22", m[1].upper())))
    extend(_find_all(r"(?<![A-Za-z0-9])(FP[IO])\s*[-–—]?\s*([0-9][A-Z]?|[A-D][A-Z]{0,2})(?![A-Za-z0-9])", t,
                     lambda m: ("MS 630-01", f"{m[1].upper()}-{m[2].upper()}")))
    extend(_near(r"0*391" + _SEP + r"674", r"(?<![A-Za-z0-9])([GKDPZNMLFX][1-5])(?![A-Za-z0-9])", t,
                 "WN 0000 0391 674", lambda m: m[1].upper()))
    extend(_near(r"L" + _SEP + r"KR" + _SEP + r"0433", r"(?:Best[äa]ndigkeitsklasse|BKK)" + _SEP + r"([1-4])(?![0-9])", t,
                 "L-KR-0433", lambda m: f"Beständigkeitsklasse {m[1]}"))
    for m in re.finditer(r"\bSWN" + _SEP + r"(010[123])\b", t, re.IGNORECASE):
        system = f"SWN {m[1]}"
        tail = t[m.end(): m.end() + 60]
        af = re.search(r"(?:Anwendungsfall|AF)" + _SEP + r"(\d{2})\b", tail, re.IGNORECASE)
        extend([(system, f"Anwendungsfall {af[1]}")] if af else [])
    extend(_find_all(r"(?:VCS" + _SEP + r"5751" + _SEP + r"7\b.{0,30}?|painting\s+class(?:es)?\s+)([DE])\s*([123])(?![0-9])", t,
                     lambda m: ("VCS 5751,7", f"{m[1].upper()}{m[2]}")))
    extend(_find_all(r"painting\s+class(?:es)?\s+([ABC])\s*([123])(?![0-9])", t,
                     lambda m: ("VCS 5751", f"{m[1].upper()}{m[2]}")))
    extend(_near(r"\bTM" + _SEP + r"5001\b", r"grade" + _SEP + r"(10|11|20|30)(?![0-9])", t,
                 "TM-5001", lambda m: f"Grade {m[1]}"))
    extend(_find_all(r"\bWSS" + _SEP + r"M2P177" + _SEP + r"(C[123])(?![0-9])", t,
                     lambda m: ("WSS-M2P177", m[1].upper())))
    extend(_near(r"\bSTD" + _SEP + r"4111\b", r"(?<![A-Za-z0-9])([A-D][1-3])(?![A-Za-z0-9])", t,
                 "STD4111", lambda m: m[1].upper()))
    return pairs


def _bmw_deviation(text: str) -> int | None:
    m = re.search(r"KWT\s*(\d{1,2})(?![0-9])", _clean(text), re.IGNORECASE)
    return int(m[1]) if m else None


def _document_level(text: str, entries: list[dict]) -> list[dict]:
    """Norms whose document number alone is the requirement (Hauraton, DAF,
    Liebherr, ...), matched with any spacing/punctuation between parts."""
    t = _clean(text)
    found = []
    for e in entries:
        if e["code"]:
            continue
        for candidate in [e["system"], *e.get("alias_texts", [])]:
            runs = re.findall(r"[A-Za-z0-9]+", candidate)
            if not runs:
                continue
            pattern = r"(?<![A-Za-z0-9])" + _SEP.join(re.escape(r) for r in runs) + r"(?![0-9])"
            if re.search(pattern, t, re.IGNORECASE):
                found.append(e)
                break
    return found


def _thickness_payload(thickness: dict | None) -> dict | None:
    """Only a real number fills Schichtdicke; a sentence such as "gemäß
    Zeichnung" stays in the facts instead."""
    if not thickness or (thickness.get("min") is None and thickness.get("max") is None):
        return None
    return {
        "min": thickness.get("min"),
        "max": thickness.get("max"),
        "mid": thickness.get("mid"),
        "unit": thickness.get("unit") or "µm",
        "display": thickness.get("display"),
    }


def to_specification(entry: dict, query_text: str) -> dict:
    """Same shape as kb_repo.lookup_specification() returns for VW, plus a
    display `label` - so the Specification column, Schichtdicke and the
    test-report prefill all work unchanged."""
    facts = [dict(f) for f in entry.get("facts") or []]
    thickness = entry.get("thickness")
    if thickness and _thickness_payload(thickness) is None and thickness.get("display"):
        facts.insert(0, {"label": "coating_thickness_note", "value": thickness["display"], "unit": "",
                         "detail": "", "document": entry.get("source_document") or ""})
    if entry["system"] == "GS 90011":
        deviation = _bmw_deviation(query_text)
        if deviation:
            for fact in facts:
                if fact["label"] == "corrosion_test_cycles":
                    fact["value"] = str(deviation)
                    fact["detail"] = f"Abweichende Prüfdauer laut Zeichnung (KWT{deviation}). " + fact["detail"]
    return {
        "matched": True,
        "source": "catalog",
        "code": entry["code"] or None,
        "label": entry["designation"],
        "customer": entry["customer"],
        "queryText": query_text,
        "documentNumber": entry["system"],
        "meaning": entry.get("meaning"),
        "governingDocument": entry.get("source_document"),
        "thickness": _thickness_payload(thickness),
        "keyFacts": facts,
        "coverage": entry.get("coverage"),
        "notes": entry.get("notes"),
    }


async def lookup(text: str) -> dict | None:
    if not text or not text.strip():
        return None
    pairs = parse(text)
    if pairs:
        keys = [key(system, code) for system, code in pairs]
        rows = {r["match_key"]: r for r in await _entries_by_keys(keys)}
        alias_rows = {a: r for r in rows.values() for a in r.get("aliases") or []}
        for k in keys:
            entry = rows.get(k) or alias_rows.get(k)
            if entry:
                return to_specification(entry, text)
    # Fall back to a document-level norm named anywhere in the text.
    matches = _document_level(text, await _document_level_entries())
    if matches:
        return to_specification(matches[0], text)
    return None


async def _document_level_entries() -> list[dict]:
    """The ~15 entries whose document number alone is the norm. Their raw
    alias spellings are not a database column, so they come from the file."""
    alias_texts = {e["match_key"]: e.get("alias_texts", []) for e in _load_file()["entries"] if not e["code"]}
    try:
        pool = await get_pool()
        rows = await pool.fetch(f"SELECT {_COLUMNS} FROM norm_catalog WHERE code = ''")
        entries = [_row(r) for r in rows] if rows else None
    except Exception as error:  # noqa: BLE001
        print("norm_catalog document-level read failed, using file:", repr(error))
        entries = None
    if entries is None:
        entries = [dict(e) for e in _load_file()["entries"] if not e["code"]]
    for e in entries:
        e["alias_texts"] = alias_texts.get(e["match_key"], [])
    return entries


def wizard_cycles(facts: list[dict]) -> int | None:
    """What the test-report wizard would pre-fill: the highest PV 1210-style
    cycle count, and only if it is one of the wizard's own options. Mirrors
    Documents.jsx's createTestReport prefill."""
    values = []
    for fact in facts or []:
        if fact.get("label") != "cyclic_corrosion_cycles":
            continue
        try:
            values.append(int(str(fact.get("value")).strip()))
        except ValueError:
            continue
    best = max(values) if values else None
    return best if best in WIZARD_CYCLES else None
