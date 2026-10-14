import React, { useMemo, useState } from "react";
import { ClipboardCheck, Plus, Search, SquarePen, Trash2 } from "lucide-react";
import { useTranslation } from "../i18n/LanguageContext";
import "../components/EightDReport/eightDReport.css";

const formatTimestampDots = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Every saved 8D report (a report is saved when it is downloaded from the
// wizard's View Report step). Same page-header pattern as All Documents /
// Test Report Overview. `records` comes from App.jsx (GET /api/eightd-reports);
// Open loads a record back into the Create Report wizard for editing, Delete
// removes it after a confirmation - deleting is permanent.
const EightDReportOverview = ({ records = [], loading = false, onOpen, onDelete, onCreate }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((row) =>
      [row.reportNo, row.customerReference, row.partName, row.customer, row.complaintDate]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [records, query]);

  const handleDelete = async (row) => {
    const label = row.reportNo || row.partName || `#${row.id}`;
    if (!window.confirm(t("eightD.deleteConfirm", { report: label }))) return;
    setDeletingId(row.id);
    try {
      await onDelete?.(row.id);
    } catch {
      window.alert(t("eightD.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="eightd-page">
      <div className="eightd-card">
        <div className="eightd-ov-header">
          <span className="eightd-ov-header-icon">
            <ClipboardCheck size={13} />
          </span>
          <div className="eightd-ov-heading">
            <h2 className="eightd-ov-title">{t("eightD.overviewTitle")}</h2>
            <p className="eightd-ov-subtitle">{t("eightD.overviewSubtitle")}</p>
          </div>
          {onCreate && (
            <button type="button" className="eightd-btn eightd-btn--solid eightd-ov-create" onClick={onCreate}>
              <Plus size={14} />
              {t("sidebar.eightDReportGenerate")}
            </button>
          )}
        </div>

        {records.length === 0 && !loading ? (
          <div className="eightd-placeholder">
            <span className="eightd-placeholder-icon">
              <ClipboardCheck size={22} />
            </span>
            <p className="eightd-placeholder-title">{t("eightD.noReportsTitle")}</p>
            <p className="eightd-placeholder-text">{t("eightD.noReportsText")}</p>
          </div>
        ) : (
          <>
            <label className="eightd-ov-search">
              <Search size={14} />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("eightD.overviewSearch")}
                aria-label={t("eightD.overviewSearch")}
              />
            </label>

            <div className="eightd-ov-table-wrap">
              <table className="eightd-ov-table">
                <thead>
                  <tr>
                    <th>{t("eightD.colNo")}</th>
                    <th>{t("eightD.reportNo")}</th>
                    <th>{t("eightD.customerReferenceNumber")}</th>
                    <th>{t("eightD.partName")}</th>
                    <th>{t("eightD.colCustomer")}</th>
                    <th>{t("eightD.complaintDate")}</th>
                    <th>{t("eightD.colLastSaved")}</th>
                    <th>{t("eightD.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="eightd-ov-empty">
                        {loading ? t("eightD.loadingReport") : t("eightD.noMatches")}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, index) => (
                      <tr key={row.id}>
                        <td>{index + 1}</td>
                        <td className="eightd-ov-strong">{row.reportNo || "—"}</td>
                        <td>{row.customerReference || "—"}</td>
                        <td>{row.partName || "—"}</td>
                        <td>{row.customer || "—"}</td>
                        <td>{row.complaintDate || "—"}</td>
                        <td>{formatTimestampDots(row.updatedAt)}</td>
                        <td>
                          <div className="eightd-ov-actions">
                            <button
                              type="button"
                              className="eightd-ov-action"
                              onClick={() => onOpen?.(row.id)}
                              aria-label={t("eightD.openReport")}
                              title={t("eightD.openReport")}
                            >
                              <SquarePen size={14} />
                            </button>
                            <button
                              type="button"
                              className="eightd-ov-action eightd-ov-action--danger"
                              onClick={() => handleDelete(row)}
                              disabled={deletingId === row.id}
                              aria-label={t("eightD.deleteReport")}
                              title={t("eightD.deleteReport")}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="eightd-ov-count">{t("eightD.overviewCount", { count: filtered.length, total: records.length })}</p>
          </>
        )}
      </div>
    </main>
  );
};

export default EightDReportOverview;
