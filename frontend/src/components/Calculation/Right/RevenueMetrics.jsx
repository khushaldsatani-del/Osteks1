import React from "react";
import { TrendingUp } from "lucide-react";
import { formatEUR, formatNumber } from "../format";
import { useTranslation } from "../../../i18n/LanguageContext";

const RevenueMetrics = ({ revenuePerCarrier, revenuePerM2, annualRevenue }) => {
  const { t } = useTranslation();
  return (
    <div className="calc-card">
      <div className="calc-card-header">
        <span className="calc-card-icon calc-card-icon--green">
          <TrendingUp size={16} />
        </span>
        <h3 className="calc-card-title">{t("revenueMetrics.title")}</h3>
      </div>

      <div className="calc-metric-list">
        <div className="calc-metric-row">
          <span>{t("revenueMetrics.revenuePerCarrier")}</span>
          <strong>{formatEUR(revenuePerCarrier)}</strong>
        </div>

        <div className="calc-metric-row">
          <span>{t("revenueMetrics.revenuePerM2")}</span>
          <strong>{formatNumber(revenuePerM2, 2, " €/m²")}</strong>
        </div>

        <div className="calc-metric-row">
          <span>{t("revenueMetrics.revenuePerYear")}</span>
          <strong>{formatEUR(annualRevenue)}</strong>
        </div>
      </div>
    </div>
  );
};

export default RevenueMetrics;
