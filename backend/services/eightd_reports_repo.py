from services.db import get_pool

# Every row returned here is already shaped in camelCase, matching the JSON
# the frontend expects (same convention as documents_repo / test_reports_repo).

_SUMMARY_FIELDS = """
    id, report_no, customer_reference, part_name, customer, complaint_date,
    status, created_at, updated_at
"""


def _summary(row) -> dict:
    return {
        "id": row["id"],
        "reportNo": row["report_no"],
        "customerReference": row["customer_reference"],
        "partName": row["part_name"],
        "customer": row["customer"],
        "complaintDate": row["complaint_date"],
        "status": row["status"],
        "createdAt": row["created_at"].isoformat(),
        "updatedAt": row["updated_at"].isoformat(),
    }


def _full(row) -> dict:
    return {**_summary(row), "wizardState": row["wizard_state"]}


# List view for the 8D Report Overview - deliberately without wizard_state,
# which the list never needs.
async def list_reports() -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(f"SELECT {_SUMMARY_FIELDS} FROM eightd_reports ORDER BY updated_at DESC")
    return [_summary(row) for row in rows]


async def get_report(report_id: int) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(f"SELECT {_SUMMARY_FIELDS}, wizard_state FROM eightd_reports WHERE id = $1", report_id)
    return _full(row) if row else None


async def create_report(fields: dict) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        f"""
        INSERT INTO eightd_reports
            (report_no, customer_reference, part_name, customer, complaint_date, wizard_state)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING {_SUMMARY_FIELDS}, wizard_state
        """,
        fields.get("reportNo") or "",
        fields.get("customerReference") or "",
        fields.get("partName") or "",
        fields.get("customer") or "",
        fields.get("complaintDate") or "",
        fields.get("wizardState") or {},
    )
    return _full(row)


# One full snapshot of the wizard, written on every download - the same
# "rewrite the whole form" approach as the Test Report's Save. Fields left
# out of the request (None) keep their stored value.
async def update_report(report_id: int, fields: dict) -> dict | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        f"""
        UPDATE eightd_reports SET
            report_no = COALESCE($2, report_no),
            customer_reference = COALESCE($3, customer_reference),
            part_name = COALESCE($4, part_name),
            customer = COALESCE($5, customer),
            complaint_date = COALESCE($6, complaint_date),
            wizard_state = COALESCE($7, wizard_state),
            updated_at = now()
        WHERE id = $1
        RETURNING {_SUMMARY_FIELDS}, wizard_state
        """,
        report_id,
        fields.get("reportNo"),
        fields.get("customerReference"),
        fields.get("partName"),
        fields.get("customer"),
        fields.get("complaintDate"),
        fields.get("wizardState"),
    )
    return _full(row) if row else None


async def delete_report(report_id: int) -> bool:
    pool = await get_pool()
    result = await pool.execute("DELETE FROM eightd_reports WHERE id = $1", report_id)
    return result != "DELETE 0"
