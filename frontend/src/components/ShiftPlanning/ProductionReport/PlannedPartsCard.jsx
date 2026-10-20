import React from "react";
import { Check, Minus, TriangleAlert } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../shared/ShiftCard";
import QtyInput from "../Planning/QtyInput";
import { PLAN_LINES } from "../Planning/planningData";
import { formatNumber } from "../shared/shiftFormat";
import { rowStatus } from "./reportMath";

const lineName = (id) => PLAN_LINES.find((line) => line.id === id)?.name ?? id;

const STATUS_ICONS = { ok: Check, less: TriangleAlert, more: TriangleAlert, open: Minus };

// The shift's planned parts with a field for the pieces actually coated.
const PlannedPartsCard = ({ shiftName, rows, coated, onChange, totals }) => {
  const { t, language } = useTranslation();
  const n = (value) => formatNumber(language, value);
  const signed = (value) => `${value > 0 ? "+" : ""}${n(value)}`;

  return (
    <ShiftCard className="prep-parts" title={t("shiftReport.partsTitle", { shift: shiftName })}>
      <div className="sp-table-wrap">
        <table className="sp-table splan-table prep-table">
          <thead>
            <tr>
              <th>{t("shiftPlan.colPartNo")}</th>
              <th>{t("shiftPlan.colName")}</th>
              <th className="splan-center">{t("shiftPlan.colLine")}</th>
              <th className="sp-num">{t("shiftReport.colPlanned")}</th>
              <th className="splan-center">{t("shiftReport.colCoated")}</th>
              <th className="splan-center">{t("shiftReport.colDifference")}</th>
              <th className="splan-center">{t("shiftReport.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="splan-empty">
                  {t("shiftReport.noParts")}
                </td>
              </tr>
            ) : (
              rows.map((part) => {
                const value = coated[part.id] ?? null;
                const status = rowStatus(part.planned, value);
                const diff = value == null ? null : value - part.planned;
                const Icon = STATUS_ICONS[status];
                return (
                  <tr key={part.id}>
                    <td className="splan-part">{part.part}</td>
                    <td>{part.name || <span className="splan-muted">-</span>}</td>
                    <td className="splan-center">
                      <span className={`splan-line splan-line--${part.line}`}>{lineName(part.line)}</span>
                    </td>
                    <td className="sp-num splan-strong">{n(part.planned)}</td>
                    <td className="splan-center">
                      <QtyInput
                        className="prep-coated"
                        value={value}
                        allowEmpty
                        onChange={(qty) => onChange(part.id, qty)}
                        label={t("shiftReport.coatedLabel", { part: part.name ? `${part.part} ${part.name}` : part.part })}
                      />
                    </td>
                    <td className="splan-center">
                      {diff == null ? (
                        <span className="splan-muted">-</span>
                      ) : diff === 0 ? (
                        n(0)
                      ) : (
                        <span className={`splan-pill ${diff < 0 ? "splan-pill--red" : "prep-pill--green"}`}>{signed(diff)}</span>
                      )}
                    </td>
                    <td className="splan-center">
                      <span className={`prep-status prep-status--${status}`}>
                        <Icon size={13} strokeWidth={status === "ok" ? 3 : 2.4} />
                        {t(`shiftReport.status_${status}`)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>{t("shiftPlan.total")}</td>
              <td className="sp-num">{n(totals.planned)}</td>
              <td className="splan-center">{n(totals.coated)}</td>
              <td className="splan-center">
                <span className={totals.difference < 0 ? "prep-total-neg" : totals.difference > 0 ? "prep-total-pos" : ""}>
                  {signed(totals.difference)}
                </span>
              </td>
              <td className="splan-center prep-open-count">
                {totals.open > 0 ? t("shiftReport.openCount", { count: totals.open }) : ""}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </ShiftCard>
  );
};

export default PlannedPartsCard;
