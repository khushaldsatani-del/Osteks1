import React from "react";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../shared/ShiftCard";
import { PLAN_LINES } from "./planningData";
import { addDays, formatDateDots, formatMoney, formatNumber } from "../shared/shiftFormat";

const lineName = (id) => PLAN_LINES.find((line) => line.id === id)?.name ?? id;

// Due on or before the plan's day = overdue; later = due soon; a part moved
// back from the plan has no due date.
const reasonOf = (item) => (item.dueOffset == null ? "removed" : item.dueOffset <= 0 ? "overdue" : "dueSoon");

// Parts with an order that are not in the plan yet. "Add to Plan" moves a
// part into the parts table with nothing planned, ready for its quantities
// (or Auto-plan).
const WaitingListCard = ({ waiting, date, onAddToPlan }) => {
  const { t, language } = useTranslation();

  return (
    <ShiftCard
      className="splan-card"
      heading={
        <h3 className="sp-card-title splan-waiting-title">
          {t("shiftPlan.waitingTitle")} <span>{t("shiftPlan.waitingNote")}</span>
          <span className="splan-count">{waiting.length}</span>
        </h3>
      }
    >
      <div className="sp-table-wrap">
        <table className="sp-table splan-table splan-table--waiting">
          <thead>
            <tr>
              <th>{t("shiftPlan.colPartNo")}</th>
              <th>{t("shiftPlan.colName")}</th>
              <th className="splan-center">{t("shiftPlan.colLine")}</th>
              <th className="sp-num">{t("shiftPlan.colOrderQty")}</th>
              <th className="sp-num">{t("shiftPlan.colPrice")}</th>
              <th className="sp-num">{t("shiftPlan.colValue")}</th>
              <th className="sp-num">
                {t("shiftPlan.colOpen")} {t("shiftPlan.pieces")}
              </th>
              <th>{t("shiftPlan.colDueDate")}</th>
              <th>{t("shiftPlan.colReason")}</th>
              <th className="splan-center">{t("shiftPlan.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {waiting.length === 0 ? (
              <tr>
                <td colSpan={10} className="splan-empty">
                  {t("shiftPlan.waitingEmpty")}
                </td>
              </tr>
            ) : (
              waiting.map((item) => {
                const reason = reasonOf(item);
                return (
                  <tr key={item.id}>
                    <td className="splan-part">{item.part}</td>
                    <td>{item.name || <span className="splan-muted">-</span>}</td>
                    <td className="splan-center">
                      <span className={`splan-line splan-line--${item.line}`}>{lineName(item.line)}</span>
                    </td>
                    <td className="sp-num">{item.orderQty ? formatNumber(language, item.orderQty) : "-"}</td>
                    <td className="sp-num">{formatMoney(language, item.price)}</td>
                    <td className="sp-num">{item.orderQty ? formatMoney(language, item.orderQty * item.price) : "-"}</td>
                    <td className="sp-num">{item.orderQty ? formatNumber(language, item.orderQty) : "-"}</td>
                    <td>{item.dueOffset == null ? "-" : formatDateDots(addDays(date, item.dueOffset))}</td>
                    <td>
                      <span className={`splan-reason splan-reason--${reason}`}>{t(`shiftPlan.reason_${reason}`)}</span>
                    </td>
                    <td className="splan-center">
                      <button
                        type="button"
                        className="splan-btn splan-btn--small"
                        onClick={() => onAddToPlan(item.id)}
                        aria-label={t("shiftPlan.addToPlanFor", { part: item.part })}
                      >
                        <ArrowRight size={14} />
                        {t("shiftPlan.addToPlan")}
                      </button>
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

export default WaitingListCard;
