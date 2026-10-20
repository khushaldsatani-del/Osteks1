import hashlib
import time
from datetime import date

from services.db import get_pool
from services.production_import import BACKLOG_METRICS, carry_forward_days, parse_workbook

# Reads and writes the production_* tables (services/production_db.py).
# Rows are returned in camelCase, same convention as the other *_repo files.
#
# Import is two-step: preview_import() parses the file and compares it with
# what is already stored (nothing is written to the values table), then
# commit_import() writes it. Both the manual upload and the later automatic
# daily feed go through these two functions.

_TOLERANCE = 1e-6

# The dashboard's data changes only when an upload is saved, while every
# database round trip to Neon costs ~200-300 ms (more after an idle pause,
# when the connection has to be re-opened). So the backlog series and the
# per-metric overview are kept in memory: commit_import() refreshes them,
# and the TTL only matters when several server instances run side by side
# (an import on one is seen by the others within that time).
_CACHE_TTL_SECONDS = 600
_cache: dict[str, tuple[float, object]] = {}


def _cached(key: str):
    hit = _cache.get(key)
    return hit[1] if hit and time.monotonic() - hit[0] < _CACHE_TTL_SECONDS else None


def _store(key: str, value):
    _cache[key] = (time.monotonic(), value)
    return value


def invalidate_cache() -> None:
    _cache.clear()

_UPLOAD_FIELDS = "id, file_name, file_hash, file_size, source, status, summary, uploaded_at, committed_at"


def _upload(row) -> dict:
    return {
        "id": row["id"],
        "fileName": row["file_name"],
        "fileSize": row["file_size"],
        "source": row["source"],
        "status": row["status"],
        "summary": row["summary"],
        "uploadedAt": row["uploaded_at"].isoformat(),
        "committedAt": row["committed_at"].isoformat() if row["committed_at"] else None,
    }


async def preview_import(content: bytes, file_name: str, source: str = "manual") -> dict:
    parsed = parse_workbook(content)
    values = parsed["values"]
    file_hash = hashlib.sha256(content).hexdigest()
    pool = await get_pool()

    existing: dict[tuple[str, str], float] = {}
    if values:
        days = [day for day, _ in values]
        rows = await pool.fetch(
            "SELECT day, metric, value FROM production_daily_values WHERE day BETWEEN $1 AND $2",
            date.fromisoformat(min(days)),
            date.fromisoformat(max(days)),
        )
        existing = {(row["day"].isoformat(), row["metric"]): float(row["value"]) for row in rows}

    # Per value: new (nothing stored), changed (stored, different), or
    # unchanged. Per day: new if nothing at all is stored for it yet.
    stored_days = {day for day, _ in existing}
    counts = {"new": 0, "changed": 0, "unchanged": 0}
    changed_days: set[str] = set()
    for key, value in values.items():
        if key not in existing:
            counts["new"] += 1
        elif abs(existing[key] - value) > _TOLERANCE:
            counts["changed"] += 1
            changed_days.add(key[0])
        else:
            counts["unchanged"] += 1
    file_days = {day for day, _ in values}
    backlog_days = {day for day, metric in values if metric in BACKLOG_METRICS}

    previous = await pool.fetchrow(
        "SELECT id, uploaded_at FROM production_uploads WHERE file_hash = $1 AND status = 'committed' "
        "ORDER BY uploaded_at DESC LIMIT 1",
        file_hash,
    )
    summary = {
        "months": parsed["months"],
        "warnings": parsed["warnings"],
        "metricCount": len(parsed["metrics"]),
        "valueCount": len(values),
        "dayCount": len(file_days),
        "firstDate": min(file_days) if file_days else None,
        "lastDate": max(file_days) if file_days else None,
        "backlogFirstDate": min(backlog_days) if backlog_days else None,
        "backlogLastDate": max(backlog_days) if backlog_days else None,
        "backlogDayCount": len(backlog_days),
        "values": counts,
        "daysNew": len(file_days - stored_days),
        "daysChanged": len(changed_days),
        "duplicateOf": {"id": previous["id"], "uploadedAt": previous["uploaded_at"].isoformat()} if previous else None,
    }
    stored = {
        "values": [[day, metric, value] for (day, metric), value in values.items()],
        "metrics": parsed["metrics"],
        "carryForward": sorted(carry_forward_days(values)),
    }
    row = await pool.fetchrow(
        f"""
        INSERT INTO production_uploads (file_name, file_hash, file_size, source, status, summary, parsed)
        VALUES ($1, $2, $3, $4, 'preview', $5, $6)
        RETURNING {_UPLOAD_FIELDS}
        """,
        file_name,
        file_hash,
        len(content),
        source,
        summary,
        stored,
    )
    return _upload(row)


async def commit_import(upload_id: int) -> dict | None:
    """Write a previewed upload's values. Returns None if there is no such
    upload, raises ValueError if it is not a preview any more."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "SELECT status, parsed FROM production_uploads WHERE id = $1 FOR UPDATE", upload_id
            )
            if row is None:
                return None
            if row["status"] != "preview" or not row["parsed"]:
                raise ValueError("This upload has already been processed.")
            parsed = row["parsed"]

            metrics = parsed["metrics"]
            await conn.execute(
                """
                INSERT INTO production_metrics (key, label, sort_order)
                SELECT * FROM unnest($1::text[], $2::text[], $3::int[])
                ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order
                """,
                list(metrics),
                [meta["label"] for meta in metrics.values()],
                [meta["order"] for meta in metrics.values()],
            )

            carry = set(parsed["carryForward"])
            values = parsed["values"]
            await conn.execute(
                """
                INSERT INTO production_daily_values (day, metric, value, is_carry_forward, upload_id)
                SELECT d, m, v, c, $5 FROM unnest($1::date[], $2::text[], $3::numeric[], $4::bool[]) AS t(d, m, v, c)
                ON CONFLICT (day, metric) DO UPDATE SET
                    value = EXCLUDED.value,
                    is_carry_forward = EXCLUDED.is_carry_forward,
                    upload_id = EXCLUDED.upload_id,
                    updated_at = now()
                WHERE production_daily_values.value IS DISTINCT FROM EXCLUDED.value
                   OR production_daily_values.is_carry_forward IS DISTINCT FROM EXCLUDED.is_carry_forward
                """,
                [date.fromisoformat(day) for day, _, _ in values],
                [metric for _, metric, _ in values],
                [value for _, _, value in values],
                [day in carry and metric in BACKLOG_METRICS for day, metric, _ in values],
                upload_id,
            )

            updated = await conn.fetchrow(
                f"""
                UPDATE production_uploads SET status = 'committed', parsed = NULL, committed_at = now()
                WHERE id = $1 RETURNING {_UPLOAD_FIELDS}
                """,
                upload_id,
            )
    invalidate_cache()
    await warm_cache()
    return _upload(updated)


async def warm_cache() -> None:
    """Load the dashboard data into memory (at startup and after an import)
    so the first visitor doesn't wait for the database. Never raises."""
    try:
        await backlog_series(None, None)
        await metric_coverage()
    except Exception as error:  # the page still works, it just loads from the DB
        print("production cache warm-up failed:", repr(error))


async def discard_import(upload_id: int) -> bool:
    pool = await get_pool()
    result = await pool.execute(
        "UPDATE production_uploads SET status = 'discarded', parsed = NULL WHERE id = $1 AND status = 'preview'",
        upload_id,
    )
    return result.endswith(" 1")


async def _record_upload(file_name: str, content: bytes, source: str, status: str, summary: dict) -> dict:
    """A history row for an upload that wasn't imported (failed / no new
    data) - so the Upload page shows what the automatic feed did each day."""
    pool = await get_pool()
    row = await pool.fetchrow(
        f"""
        INSERT INTO production_uploads (file_name, file_hash, file_size, source, status, summary)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING {_UPLOAD_FIELDS}
        """,
        file_name,
        hashlib.sha256(content).hexdigest(),
        len(content),
        source,
        status,
        summary,
    )
    return _upload(row)


async def auto_import(content: bytes, file_name: str, final: bool) -> dict:
    """The daily automatic feed (automation/osteks-sync): preview + save in
    one step, no human check in between. Returns {"status": ...}:
      committed - new data saved (same importer as a manual upload);
      unchanged - this exact file is already imported (the share's file
                  wasn't updated yet). Only the sender's last attempt of
                  the morning (final=True) leaves a "No new data" row, so
                  the retries every 30 minutes don't fill the history;
      failed    - the file couldn't be read; recorded with the reason, and
                  the stored data is left as it was.
    """
    pool = await get_pool()
    file_hash = hashlib.sha256(content).hexdigest()
    already = await pool.fetchval(
        "SELECT id FROM production_uploads WHERE file_hash = $1 AND status = 'committed' LIMIT 1", file_hash
    )
    if already:
        if not final:
            return {"status": "unchanged"}
        upload = await _record_upload(
            file_name, content, "auto", "unchanged", {"note": "The file had not changed since the last import.", "sameAs": already}
        )
        return {"status": "unchanged", "upload": upload}

    try:
        preview = await preview_import(content, file_name, source="auto")
    except Exception as error:  # an unreadable / non-Excel file
        reason = f"The file could not be read as an Excel workbook ({type(error).__name__})."
        upload = await _record_upload(file_name, content, "auto", "failed", {"error": reason})
        return {"status": "failed", "error": reason, "upload": upload}

    if preview["summary"]["valueCount"] == 0:
        await discard_import(preview["id"])
        reason = "No values were found in the file."
        upload = await _record_upload(file_name, content, "auto", "failed", {"error": reason})
        return {"status": "failed", "error": reason, "upload": upload}

    # Re-saved but with the same numbers (e.g. opened and saved before the
    # morning's values were filled in) - not new data yet, so the sender
    # keeps waiting, same as for an identical file.
    counts = preview["summary"]["values"]
    if counts["new"] == 0 and counts["changed"] == 0:
        await discard_import(preview["id"])
        if not final:
            return {"status": "unchanged"}
        upload = await _record_upload(
            file_name, content, "auto", "unchanged", {"note": "The file was saved again, but no values had changed."}
        )
        return {"status": "unchanged", "upload": upload}

    return {"status": "committed", "upload": await commit_import(preview["id"])}


async def latest_pending_preview() -> dict | None:
    """The newest upload still waiting for "Save to database" - so a preview
    isn't lost when the Upload page is left before saving."""
    pool = await get_pool()
    row = await pool.fetchrow(
        f"SELECT {_UPLOAD_FIELDS} FROM production_uploads WHERE status = 'preview' ORDER BY uploaded_at DESC LIMIT 1"
    )
    return _upload(row) if row else None


async def list_uploads(limit: int = 100) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        f"SELECT {_UPLOAD_FIELDS} FROM production_uploads WHERE status NOT IN ('preview', 'discarded') "
        "ORDER BY uploaded_at DESC LIMIT $1",
        limit,
    )
    return [_upload(row) for row in rows]


async def backlog_series(date_from: date | None, date_to: date | None) -> dict:
    """Daily backlog (T€) per category, only days that have all three, plus
    the first/last day stored so the dashboard can bound its range picker.
    One query, served from memory between imports (see _cache)."""
    series = _cached("backlog")
    if series is None:
        pool = await get_pool()
        rows = await pool.fetch(
            """
            SELECT day, metric, value, is_carry_forward FROM production_daily_values
            WHERE metric = ANY($1::text[]) ORDER BY day
            """,
            list(BACKLOG_METRICS),
        )
        by_day: dict[str, dict] = {}
        for row in rows:
            entry = by_day.setdefault(row["day"].isoformat(), {"carryForward": False})
            entry[row["metric"].removeprefix("auftragsbestand_")] = round(float(row["value"]), 4)
            entry["carryForward"] = entry["carryForward"] or row["is_carry_forward"]
        days = [
            {"date": day, **entry}
            for day, entry in by_day.items()
            if all(metric.removeprefix("auftragsbestand_") in entry for metric in BACKLOG_METRICS)
        ]
        series = _store(
            "backlog",
            {
                "firstDate": days[0]["date"] if days else None,
                "lastDate": days[-1]["date"] if days else None,
                "days": days,
            },
        )
    if date_from is None and date_to is None:
        return series
    start = date_from.isoformat() if date_from else ""
    end = date_to.isoformat() if date_to else "9999"
    return {**series, "days": [d for d in series["days"] if start <= d["date"] <= end]}


async def metric_coverage() -> list[dict]:
    """Every stored metric with how many days it has and its first/last day
    - the Upload page's "Data in the database" overview. Cached like the
    backlog series."""
    cached = _cached("coverage")
    if cached is not None:
        return cached
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT m.key, m.label, count(v.day) AS days, min(v.day) AS first, max(v.day) AS last
        FROM production_metrics m LEFT JOIN production_daily_values v ON v.metric = m.key
        GROUP BY m.key, m.label, m.sort_order ORDER BY m.sort_order
        """
    )
    return _store("coverage", [
        {
            "key": row["key"],
            "label": row["label"],
            "days": row["days"],
            "firstDate": row["first"].isoformat() if row["first"] else None,
            "lastDate": row["last"].isoformat() if row["last"] else None,
        }
        for row in rows
    ])
