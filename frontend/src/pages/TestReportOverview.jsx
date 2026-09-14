import React, { useMemo, useState } from "react";
import { FileText, Search, RotateCcw, Eye, Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "../i18n/LanguageContext";
import "./testReportOverview.css";

const formatDateDots = (isoDate) => {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
};

// `createdAt`/`updatedAt` are full TIMESTAMPTZ strings straight from
// Postgres (already carrying their own time + offset, e.g.
// "2026-09-14T10:23:45.123456+00:00") — unlike `testDate`, a plain DATE
// column ("YYYY-MM-DD"). Reusing formatDateDots' `T00:00:00` suffix on one
// of these produced an invalid string Date() couldn't parse (silently
// falling back to "—" for every row), which is why "Created" always
// showed as empty regardless of when the report was actually saved.
const formatTimestampDots = (isoTimestamp) => {
  if (!isoTimestamp) return "—";
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

// `records` is the live list from GET /api/test-reports (see
// backend/services/test_reports_repo.py's list_reports — App.jsx owns the
// fetch/state so this list survives switching away from Overview and
// back). "Test Procedure" shows each record's `norm` (the standard/code
// governing what test actually gets run), "Test Object" shows `testObject`
// (the physical part) — matching the two example rows given for this
// page's design. "View" opens the record into the Generate Report wizard
// (onOpen); "Download" has nothing to export directly from this list yet
// — that stays a Step 5 action inside the wizard itself — so it's inert
// for now, same as it was against the old mock data.
const TestReportOverview = ({ records = [], onDelete, onOpen }) => {
  const { t } = useTranslation();

  // Draft inputs vs. applied filters — matches the reference's explicit
  // "Suchen" (Search) / "Zurücksetzen" (Reset) buttons: typing doesn't
  // filter the table until Search is actually clicked (or Enter pressed).
  const [draft, setDraft] = useState({ query: "", reportNo: "", dateFrom: "", dateTo: "" });
  const [applied, setApplied] = useState({ query: "", reportNo: "", dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const query = applied.query.trim().toLowerCase();
    const reportNoQuery = applied.reportNo.trim().toLowerCase();
    return records.filter((row) => {
      if (query) {
        const haystack = `${row.norm || ""} ${row.testObject || ""} ${row.reportNo || ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (reportNoQuery && !(row.reportNo || "").toLowerCase().includes(reportNoQuery)) return false;
      if (applied.dateFrom && (!row.testDate || row.testDate < applied.dateFrom)) return false;
      if (applied.dateTo && (!row.testDate || row.testDate > applied.dateTo)) return false;
      return true;
    });
  }, [records, applied]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(clampedPage * pageSize, filtered.length);

  const runSearch = () => {
    setApplied(draft);
    setPage(1);
  };

  const resetSearch = () => {
    const empty = { query: "", reportNo: "", dateFrom: "", dateTo: "" };
    setDraft(empty);
    setApplied(empty);
    setPage(1);
  };

  const handleDelete = (id) => {
    onDelete?.(id);
  };

  return (
    <div className="tro-page">
      <div className="tro-card">
        <div className="tro-header">
          <span className="tro-header-icon">
            <FileText size={20} />
          </span>
          <div>
            <h2 className="tro-title">{t("testReportOverview.title")}</h2>
            <p className="tro-subtitle">{t("testReportOverview.subtitle")}</p>
          </div>
        </div>

        <div className="tro-search-row">
          <div className="tro-field tro-field--grow">
            <label>{t("testReportOverview.searchLabel")}</label>
            <div className="tro-input-with-icon">
              <Search size={14} />
              <input
                type="text"
                placeholder={t("testReportOverview.searchPlaceholder")}
                value={draft.query}
                onChange={(e) => setDraft((d) => ({ ...d, query: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
            </div>
          </div>

          <div className="tro-field">
            <label>{t("testReportOverview.reportNoLabel")}</label>
            <div className="tro-input-with-icon">
              <span className="tro-hash">#</span>
              <input
                type="text"
                placeholder={t("testReportOverview.reportNoPlaceholder")}
                value={draft.reportNo}
                onChange={(e) => setDraft((d) => ({ ...d, reportNo: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
            </div>
          </div>

          <div className="tro-field">
            <label>{t("testReportOverview.dateFromLabel")}</label>
            <input type="date" value={draft.dateFrom} onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))} />
          </div>

          <div className="tro-field">
            <label>{t("testReportOverview.dateToLabel")}</label>
            <input type="date" value={draft.dateTo} onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))} />
          </div>

          <button type="button" className="tro-btn tro-btn--solid" onClick={runSearch}>
            <Search size={14} />
            {t("testReportOverview.searchButton")}
          </button>

          <button type="button" className="tro-btn" onClick={resetSearch}>
            <RotateCcw size={14} />
            {t("testReportOverview.resetButton")}
          </button>
        </div>

        <div className="tro-table-wrapper">
          <table className="tro-table">
            <thead>
              <tr>
                <th>{t("testReportOverview.colNo")}</th>
                <th>{t("testReportOverview.colReportNo")}</th>
                <th>{t("testReportOverview.colProcedure")}</th>
                <th>{t("testReportOverview.colObject")}</th>
                <th>{t("testReportOverview.colTestDate")}</th>
                <th>{t("testReportOverview.colCreatedAt")}</th>
                <th>{t("testReportOverview.colStatus")}</th>
                <th>{t("testReportOverview.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => (
                <tr key={row.id}>
                  <td>{(clampedPage - 1) * pageSize + index + 1}</td>
                  <td>{row.reportNo || "—"}</td>
                  <td>{row.norm || "—"}</td>
                  <td>{row.testObject || "—"}</td>
                  <td>{formatDateDots(row.testDate)}</td>
                  <td>{formatTimestampDots(row.createdAt)}</td>
                  <td>
                    {/* "created" (saved at least once) reads as a light
                        green pill, everything else (a draft row that only
                        exists because a photo was picked or "Test
                        required" was checked, but Speichern was never
                        clicked) reads as a light red "pending" pill — see
                        TestReport.jsx's handleSave, the only place a
                        report's status ever becomes "created". */}
                    <span className={`tro-status-pill ${row.status === "created" ? "tro-status-pill--created" : "tro-status-pill--pending"}`}>
                      {row.status === "created" ? t("testReportOverview.statusCreated") : t("testReportOverview.statusPending")}
                    </span>
                  </td>
                  <td>
                    <div className="tro-row-actions">
                      <button
                        type="button"
                        className="tro-row-action-btn"
                        title={t("testReportOverview.view")}
                        onClick={() => onOpen?.(row.id)}
                      >
                        <Eye size={15} />
                      </button>
                      <button type="button" className="tro-row-action-btn" title={t("testReportOverview.download")} disabled>
                        <Download size={15} />
                      </button>
                      <button
                        type="button"
                        className="tro-row-action-btn tro-row-action-btn--danger"
                        title={t("testReportOverview.delete")}
                        onClick={() => handleDelete(row.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="tro-empty-row">
                    {t("testReportOverview.noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="tro-footer">
          <span className="tro-range">
            {t("testReportOverview.rangeLabel", { start: rangeStart, end: rangeEnd, total: filtered.length })}
          </span>

          <div className="tro-pagination">
            <button type="button" className="tro-page-btn" disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`tro-page-btn ${n === clampedPage ? "active" : ""}`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="tro-page-btn"
              disabled={clampedPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={15} />
            </button>

            <select className="tro-page-size" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {t("testReportOverview.perPage", { size })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestReportOverview;
