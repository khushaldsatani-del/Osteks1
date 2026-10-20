import React from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { KEY_FIGURES, WARNINGS } from "./dashboardData";
import { formatTons } from "../shared/shiftFormat";

// The four figures along the top: Overdue, Due in next 5 days, Planned
// today, Warnings (counted from the warnings list, as are its critical ones).
const KeyFigures = () => {
  const { t, language } = useTranslation();

  return (
    <div className="sp-figures">
      {KEY_FIGURES.map(({ id, tone, icon: Icon, value, note }) => {
        const isWarnings = id === "warnings";
        const shownValue = isWarnings ? WARNINGS.length : value;
        const noteText = isWarnings
          ? t("shiftDashboard.warningsNote", { count: WARNINGS.filter((w) => w.critical).length })
          : t(`shiftDashboard.${note.key}`, note.tons != null ? { tons: formatTons(language, note.tons) } : note.vars);
        const noteTone = isWarnings ? "red" : note.tone;

        return (
          <div key={id} className="sp-card sp-figure">
            <span className={`sp-figure-icon sp-figure-icon--${tone}`}>
              <Icon size={22} />
            </span>
            <div className="sp-figure-text">
              <p className="sp-figure-label">{t(`shiftDashboard.${id}`)}</p>
              <p className="sp-figure-value">{shownValue}</p>
              <p className={`sp-figure-note sp-figure-note--${noteTone}`}>{noteText}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KeyFigures;
