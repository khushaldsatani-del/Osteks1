import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../shared/ShiftCard";
import { LINE_CAPACITY_T, LINES, SHIFTS } from "./dashboardData";
import { formatTons } from "../shared/shiftFormat";

// Load of every line in every shift against the line's capacity. The title
// collapses the card to just its header.
const CapacityCard = () => {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <ShiftCard
      className={open ? "" : "sp-card--collapsed"}
      heading={
        <button type="button" className="sdash-card-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <h3 className="sp-card-title">{t("shiftDashboard.capacityTitle")}</h3>
          <ChevronDown size={16} className={`sdash-toggle-chevron ${open ? "" : "is-closed"}`} />
        </button>
      }
      actions={
        <ul className="sdash-legend">
          {LINES.map((line) => (
            <li key={line.id}>
              <span className={`sdash-dot sdash-line--${line.id}`} />
              {line.name}
            </li>
          ))}
        </ul>
      }
    >
      {open && (
        <div className="sdash-capacity">
          {SHIFTS.map(({ number, from, to, icon: Icon, tone, load }) => (
            <div key={number} className="sdash-capacity-row">
              <div className="sdash-shift">
                <span className={`sdash-shift-icon sdash-shift-icon--${tone}`}>
                  <Icon size={18} />
                </span>
                <div>
                  <p className="sdash-shift-name">{t("shiftDashboard.shift", { n: number })}</p>
                  <p className="sdash-shift-time">
                    {from} – {to}
                  </p>
                </div>
              </div>

              {LINES.map((line) => {
                const tons = load[line.id];
                const percent = Math.round((tons / LINE_CAPACITY_T) * 100);
                return (
                  <div key={line.id} className={`sdash-load sdash-line--${line.id}`}>
                    <p className="sdash-load-name">
                      <span className="sdash-dot" />
                      {line.name}
                    </p>
                    <div
                      className="sdash-bar"
                      role="progressbar"
                      aria-label={`${t("shiftDashboard.shift", { n: number })} ${line.name}`}
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="sdash-bar-fill" style={{ width: `${Math.min(percent, 100)}%` }} />
                    </div>
                    <p className="sdash-load-figures">
                      <strong>{percent}%</strong>
                      <span>
                        {formatTons(language, tons)} / {LINE_CAPACITY_T} t
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </ShiftCard>
  );
};

export default CapacityCard;
