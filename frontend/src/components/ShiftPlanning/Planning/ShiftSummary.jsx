import React from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { SHIFT_DEFS } from "./planningData";
import { shiftTotals } from "./planningMath";
import { formatNumber } from "../shared/shiftFormat";

// One card per shift: pieces planned against the shift's capacity, live
// from the parts table. Over capacity turns the bar and figures red.
const ShiftSummary = ({ parts }) => {
  const { t, language } = useTranslation();
  const totals = shiftTotals(parts);

  return (
    <div className="splan-shifts">
      {SHIFT_DEFS.map(({ id, name, from, to, icon: Icon, capacity }) => {
        const planned = totals[id];
        const percent = Math.round((planned / capacity) * 100);
        const over = planned > capacity;
        return (
          <div key={id} className={`sp-card splan-shift splan-shift--${id} ${over ? "is-over" : ""}`}>
            <span className="splan-shift-icon">
              <Icon size={26} />
            </span>
            <div className="splan-shift-body">
              <div className="splan-shift-top">
                <p className="splan-shift-name">{name}</p>
                <p className="splan-shift-load" title={t("shiftPlan.capacityHint")}>
                  {formatNumber(language, planned)} / {formatNumber(language, capacity)}
                </p>
              </div>
              <div className="splan-shift-bottom">
                <p className="splan-shift-time">
                  {from} – {to}
                </p>
                <div
                  className="splan-shift-bar"
                  role="progressbar"
                  aria-label={t("shiftPlan.capacityOf", { shift: name })}
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div style={{ width: `${Math.min(percent, 100)}%` }} />
                </div>
                <span className="splan-shift-percent">{percent}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ShiftSummary;
