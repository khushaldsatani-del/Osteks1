import React from "react";
import { CalendarClock, Construction } from "lucide-react";
import { useTranslation } from "../i18n/LanguageContext";
import "./shiftPlanning.css";

// Shift Planning - placeholder page until its sub-pages are specified.
// Same page-header pattern as All Documents / Test Report Overview / 8D
// Report Overview (icon badge + title + subtitle in one card), with a
// "still in development" notice as the body. When the sub-pages are known,
// this becomes an accordion entry in the sidebar like Test Report and 8D
// Report, and this page turns into one of them.
const ShiftPlanning = () => {
  const { t } = useTranslation();

  return (
    <main className="shift-page">
      <div className="shift-card">
        <div className="shift-header">
          <span className="shift-header-icon">
            <CalendarClock size={13} />
          </span>
          <div>
            <h2 className="shift-title">{t("shiftPlanning.title")}</h2>
            <p className="shift-subtitle">{t("shiftPlanning.subtitle")}</p>
          </div>
        </div>

        <div className="shift-dev">
          <span className="shift-dev-icon">
            <Construction size={22} />
          </span>
          <span className="shift-dev-badge">{t("shiftPlanning.badge")}</span>
          <p className="shift-dev-title">{t("shiftPlanning.devTitle")}</p>
          <p className="shift-dev-text">{t("shiftPlanning.devText")}</p>
        </div>
      </div>
    </main>
  );
};

export default ShiftPlanning;
