import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../../../i18n/LanguageContext";
import { PLAN_LINES, SHIFT_DEFS } from "./planningData";
import { formatDateDots, formatNumber } from "../shared/shiftFormat";

const lineName = (id) => PLAN_LINES.find((line) => line.id === id)?.name ?? id;

// "Print Shift Sheets": one A4 page per shift with the parts and pieces to
// coat in that shift, plus empty Done / Notes columns for the shop floor.
// Rendered straight into <body> and only visible when printing (see the
// @media print rules in shiftPlan.css).
const PrintShiftSheets = ({ parts, date }) => {
  const { t, language } = useTranslation();

  return createPortal(
    <div className="splan-print" aria-hidden="true">
      {SHIFT_DEFS.map((shift) => {
        const rows = parts.filter((part) => (part.plan[shift.id] || 0) > 0);
        const total = rows.reduce((sum, part) => sum + part.plan[shift.id], 0);
        return (
          <section key={shift.id} className="splan-print-page">
            <header className="splan-print-header">
              <div>
                <p className="splan-print-kicker">{t("shiftPlan.printTitle")}</p>
                <h1>
                  {t("shiftPlan.printShift", { shift: shift.name })} <span>{shift.from} – {shift.to}</span>
                </h1>
              </div>
              <p className="splan-print-date">{t("shiftPlan.printDate", { date: formatDateDots(date) })}</p>
            </header>

            {rows.length === 0 ? (
              <p className="splan-print-empty">{t("shiftPlan.printNothing")}</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("shiftPlan.colPartNo")}</th>
                    <th>{t("shiftPlan.colName")}</th>
                    <th>{t("shiftPlan.colLine")}</th>
                    <th className="num">
                      {t("shiftPlan.printQty")} {t("shiftPlan.pieces")}
                    </th>
                    <th className="done">{t("shiftPlan.printDone")}</th>
                    <th className="notes">{t("shiftPlan.printNotes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((part, index) => (
                    <tr key={part.id}>
                      <td>{index + 1}</td>
                      <td className="strong">{part.part}</td>
                      <td>{part.name}</td>
                      <td>{lineName(part.line)}</td>
                      <td className="num strong">{formatNumber(language, part.plan[shift.id])}</td>
                      <td className="done">☐</td>
                      <td className="notes" />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>{t("shiftPlan.total")}</td>
                    <td className="num">{formatNumber(language, total)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            )}

            <footer className="splan-print-sign">
              <span>{t("shiftPlan.printSignLead")}</span>
              <span>{t("shiftPlan.printSignDate")}</span>
            </footer>
          </section>
        );
      })}
    </div>,
    document.body
  );
};

export default PrintShiftSheets;
