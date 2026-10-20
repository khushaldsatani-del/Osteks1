import React, { useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../shared/ShiftCard";
import { SHIFT_DEFS } from "../Planning/planningData";
import { formatDateDots, formatNumber, fromIsoDate } from "../shared/shiftFormat";
import { PREVIOUS_SHOWN } from "./reportData";

const shiftName = (id) => SHIFT_DEFS.find((s) => s.id === id)?.name ?? id;

// Earlier reports, newest first. A report saved on this page opens again
// when its row is clicked; the sample rows are for display only.
const PreviousReportsCard = ({ reports, current, onOpen }) => {
  const { t, language } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? reports : reports.slice(0, PREVIOUS_SHOWN);
  const n = (value) => formatNumber(language, value);

  return (
    <ShiftCard
      className="prep-previous"
      title={t("shiftReport.previousTitle")}
      actions={
        reports.length > PREVIOUS_SHOWN && (
          <button type="button" className="sp-link" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t("shiftDashboard.showLess") : t("shiftDashboard.viewAll")}
          </button>
        )
      }
    >
      <div className="sp-table-wrap">
        <table className="sp-table prep-previous-table">
          <thead>
            <tr>
              <th>{t("shiftReport.colDate")}</th>
              <th>{t("shiftReport.shift")}</th>
              <th className="sp-num">{t("shiftReport.colPlannedShort")}</th>
              <th className="sp-num">{t("shiftReport.colCoatedShort")}</th>
              <th className="sp-num">{t("shiftReport.colDiffShort")}</th>
              <th className="splan-center">
                <span className="splan-sr-only">{t("shiftReport.colStatus")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="splan-empty">
                  {t("shiftReport.noPrevious")}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const diff = row.coated - row.planned;
                const isCurrent = current.iso === row.iso && current.shift === row.shift;
                const open = row.saved ? () => onOpen(row.iso, row.shift) : undefined;
                return (
                  <tr
                    key={`${row.iso}-${row.shift}`}
                    className={`${row.saved ? "is-openable" : ""} ${isCurrent ? "is-current" : ""}`}
                    onClick={open}
                    title={row.saved ? t("shiftReport.openReport") : undefined}
                  >
                    <td className="splan-strong">
                      {row.saved ? (
                        <button
                          type="button"
                          className="prep-open"
                          onClick={(event) => {
                            event.stopPropagation();
                            open();
                          }}
                          aria-label={t("shiftReport.openReportFor", {
                            date: formatDateDots(fromIsoDate(row.iso)),
                            shift: shiftName(row.shift),
                          })}
                        >
                          {formatDateDots(fromIsoDate(row.iso))}
                        </button>
                      ) : (
                        formatDateDots(fromIsoDate(row.iso))
                      )}
                    </td>
                    <td>{shiftName(row.shift)}</td>
                    <td className="sp-num">{n(row.planned)}</td>
                    <td className="sp-num">{n(row.coated)}</td>
                    <td className={`sp-num ${diff < 0 ? "sp-negative" : diff > 0 ? "prep-positive" : ""}`}>
                      {`${diff > 0 ? "+" : ""}${n(diff)}`}
                    </td>
                    <td className="splan-center">
                      <Check size={14} strokeWidth={3} className="prep-saved-check" aria-label={t("shiftReport.saved")} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </ShiftCard>
  );
};

export default PreviousReportsCard;
