import React, { useState } from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../shared/ShiftCard";
import { WARNING_TYPES, WARNINGS, WARNINGS_SHOWN } from "./dashboardData";
import { addDays, formatDateDots } from "../shared/shiftFormat";

// Open warnings for the chosen day. Shows the first few; "View all" lists
// every one.
const WarningsCard = ({ date }) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? WARNINGS : WARNINGS.slice(0, WARNINGS_SHOWN);

  return (
    <ShiftCard
      title={t("shiftDashboard.warnings")}
      actions={
        WARNINGS.length > WARNINGS_SHOWN && (
          <button type="button" className="sp-link" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t("shiftDashboard.showLess") : t("shiftDashboard.viewAll")}
          </button>
        )
      }
    >
      <div className="sp-table-wrap">
        <table className="sp-table">
          <thead>
            <tr>
              <th>{t("shiftDashboard.colType")}</th>
              <th>{t("shiftDashboard.colPartNumber")}</th>
              <th>{t("shiftDashboard.colDescription")}</th>
              <th>{t("shiftDashboard.colDate")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { icon: Icon, tone } = WARNING_TYPES[row.type];
              return (
                <tr key={row.id}>
                  <td>
                    <span className={`sdash-type sdash-type--${tone}`}>
                      <Icon size={14} />
                      <span className="sdash-type-label">{t(`shiftDashboard.type_${row.type}`)}</span>
                    </span>
                  </td>
                  <td>{row.part}</td>
                  <td>{t(`shiftDashboard.${row.descKey}`, row.descVars)}</td>
                  <td>{formatDateDots(addDays(date, row.dayOffset))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ShiftCard>
  );
};

export default WarningsCard;
