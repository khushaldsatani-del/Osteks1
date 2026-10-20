import React from "react";
import { ClipboardList, Construction } from "lucide-react";
import { useTranslation } from "../i18n/LanguageContext";
import ShiftDashboard from "../components/ShiftPlanning/Dashboard/ShiftDashboard";
import ShiftUpload from "../components/ShiftPlanning/Upload/ShiftUpload";
import ShiftPlan from "../components/ShiftPlanning/Planning/ShiftPlan";
import ProductionReport from "../components/ShiftPlanning/ProductionReport/ProductionReport";
import ShiftSettings from "../components/ShiftPlanning/Settings/ShiftSettings";
import "./shiftPlanning.css";

// The Shift Planning area's sub-pages (sidebar: Shift Planning > ...).
// Dashboard, Shift Planning, Production Report, Upload and Settings are
// built (components/ShiftPlanning/...);
// every other one
// is a placeholder until its content is specified: the usual page
// header (icon badge + title + subtitle in one card, same as All Documents /
// Test Report Overview / 8D Report Overview) and a "still in development"
// notice. `section` picks which sub-page is shown; App.jsx maps each
// sidebar page id to one of these. (Kept un-exported: this file must only
// export its component, or Vite's Fast Refresh breaks - see MEMORY.md.)
const SHIFT_SECTIONS = {
  orders: { icon: ClipboardList, key: "orders" },
};

const ShiftPlanning = ({ section = "dashboard" }) => {
  const { t } = useTranslation();
  if (section === "dashboard") return <ShiftDashboard />;
  if (section === "upload") return <ShiftUpload />;
  if (section === "planning") return <ShiftPlan />;
  if (section === "productionReport") return <ProductionReport />;
  if (section === "settings") return <ShiftSettings />;
  const { icon: Icon, key } = SHIFT_SECTIONS[section] || SHIFT_SECTIONS.orders;

  return (
    <main className="shift-page">
      <div className="shift-card">
        <div className="shift-header">
          <span className="shift-header-icon">
            <Icon size={13} />
          </span>
          <div>
            <h2 className="shift-title">{t(`shiftPlanning.${key}Title`)}</h2>
            <p className="shift-subtitle">{t(`shiftPlanning.${key}Subtitle`)}</p>
          </div>
        </div>

        <div className="shift-dev">
          <span className="shift-dev-icon">
            <Construction size={22} />
          </span>
          <span className="shift-dev-badge">{t("shiftPlanning.badge")}</span>
          <p className="shift-dev-title">{t("shiftPlanning.devTitle")}</p>
          <p className="shift-dev-text">{t("shiftPlanning.devText", { page: t(`shiftPlanning.${key}Title`) })}</p>
        </div>
      </div>
    </main>
  );
};

export default ShiftPlanning;
