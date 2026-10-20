import React, { useState } from "react";
import { CircleCheck } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../shared/ShiftCard";
import { CHART_MAX_T, CHART_TICKS, LINES, YESTERDAY } from "./dashboardData";
import { formatSignedTons, formatTons } from "../shared/shiftFormat";

// Bar chart of the day before's planned (grey) vs coated (line colour)
// tonnes per line, the totals underneath, and a per-line table behind
// "View details".
const YesterdayCard = () => {
  const { t, language } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const lineName = (id) => LINES.find((line) => line.id === id)?.name ?? id;
  const height = (tons) => `${Math.min(tons / CHART_MAX_T, 1) * 100}%`;

  const planned = YESTERDAY.reduce((sum, row) => sum + row.planned, 0);
  const coated = YESTERDAY.reduce((sum, row) => sum + row.coated, 0);
  const percent = Math.round((coated / planned) * 100);

  return (
    <ShiftCard
      title={t("shiftDashboard.yesterdayTitle")}
      actions={
        <button type="button" className="sp-link" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
          {showDetails ? t("shiftDashboard.hideDetails") : t("shiftDashboard.viewDetails")}
        </button>
      }
    >
      <ul className="sdash-legend sdash-legend--chart">
        <li>
          <span className="sdash-swatch sdash-swatch--planned" />
          {t("shiftDashboard.planned")}
        </li>
        <li>
          {LINES.map((line) => (
            <span key={line.id} className={`sdash-swatch sdash-line--${line.id}`} />
          ))}
          {t("shiftDashboard.coated")}
        </li>
      </ul>

      <div className="sdash-chart">
        <span className="sdash-chart-axis-title">{t("shiftDashboard.tonsAxis")}</span>
        <div className="sdash-chart-ticks" aria-hidden="true">
          {CHART_TICKS.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="sdash-chart-plot">
          {CHART_TICKS.map((tick) => (
            <span key={tick} className="sdash-chart-grid" style={{ bottom: height(tick) }} />
          ))}
          {YESTERDAY.map((row) => (
            <div key={row.line} className={`sdash-chart-group sdash-line--${row.line}`}>
              <div className="sdash-chart-bar sdash-chart-bar--planned" style={{ height: height(row.planned) }}>
                <span>{formatTons(language, row.planned)}</span>
              </div>
              <div className="sdash-chart-bar sdash-chart-bar--coated" style={{ height: height(row.coated) }}>
                <span>{formatTons(language, row.coated)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="sdash-chart-labels">
          {YESTERDAY.map((row) => (
            <span key={row.line}>{lineName(row.line)}</span>
          ))}
        </div>
      </div>

      {showDetails && (
        <div className="sp-table-wrap sdash-details">
          <table className="sp-table">
            <thead>
              <tr>
                <th>{t("shiftDashboard.colLine")}</th>
                <th className="sp-num">{t("shiftDashboard.planned")} (t)</th>
                <th className="sp-num">{t("shiftDashboard.coated")} (t)</th>
                <th className="sp-num">{t("shiftDashboard.colDifference")} (t)</th>
              </tr>
            </thead>
            <tbody>
              {YESTERDAY.map((row) => (
                <tr key={row.line}>
                  <td>
                    <span className={`sdash-dot sdash-line--${row.line}`} /> {lineName(row.line)}
                  </td>
                  <td className="sp-num">{formatTons(language, row.planned)}</td>
                  <td className="sp-num">{formatTons(language, row.coated)}</td>
                  <td className={`sp-num ${row.coated < row.planned ? "sp-negative" : ""}`}>
                    {formatSignedTons(language, row.coated - row.planned)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="sdash-summary">
        <span className="sdash-summary-total">
          <CircleCheck size={16} />
          {t("shiftDashboard.totalCoated", {
            coated: formatTons(language, coated),
            planned: formatTons(language, planned),
            percent,
          })}
        </span>
        <span className="sdash-summary-deviation">
          {t("shiftDashboard.deviation", { value: formatSignedTons(language, coated - planned) })}
        </span>
      </div>
    </ShiftCard>
  );
};

export default YesterdayCard;
