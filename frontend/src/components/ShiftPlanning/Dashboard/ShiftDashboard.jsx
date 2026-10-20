import React, { useState } from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import DatePickerButton from "../shared/DatePickerButton";
import KeyFigures from "./KeyFigures";
import CapacityCard from "./CapacityCard";
import WarningsCard from "./WarningsCard";
import YesterdayCard from "./YesterdayCard";
import "./shiftDashboard.css";

// Shift Planning > Dashboard: key figures, capacity by shift and line,
// open warnings and yesterday's planned vs coated tonnes. Figures are
// sample data for now (see dashboardData.js); the date picked in the header
// sets the dates shown in the warnings list.
const ShiftDashboard = () => {
  const { t } = useTranslation();
  const [date, setDate] = useState(() => new Date());

  return (
    <main className="sp-page">
      <div className="sp-header">
        <div className="sp-heading">
          <h2 className="sp-title">{t("shiftDashboard.title")}</h2>
          <p className="sp-subtitle">{t("shiftDashboard.subtitle")}</p>
        </div>
        <DatePickerButton value={date} onChange={setDate} />
      </div>

      <KeyFigures />

      <CapacityCard />

      <div className="sdash-row">
        <WarningsCard date={date} />
        <YesterdayCard />
      </div>
    </main>
  );
};

export default ShiftDashboard;
