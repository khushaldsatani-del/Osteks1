import React from "react";
import { TrendingUp } from "lucide-react";
import { formatEUR, formatNumber } from "../format";

const RevenueMetrics = ({ revenuePerCarrier, revenuePerM2, annualRevenue }) => {
  return (
    <div className="calc-card">
      <div className="calc-card-header">
        <span className="calc-card-icon calc-card-icon--green">
          <TrendingUp size={16} />
        </span>
        <h3 className="calc-card-title">Revenue Metrics</h3>
      </div>

      <div className="calc-metric-list">
        <div className="calc-metric-row">
          <span>Umsatz pro Warenträger</span>
          <strong>{formatEUR(revenuePerCarrier)}</strong>
        </div>

        <div className="calc-metric-row">
          <span>Umsatz pro m²</span>
          <strong>{formatNumber(revenuePerM2, 2, " €/m²")}</strong>
        </div>

        <div className="calc-metric-row">
          <span>Umsatz pro Jahr</span>
          <strong>{formatEUR(annualRevenue)}</strong>
        </div>
      </div>
    </div>
  );
};

export default RevenueMetrics;
