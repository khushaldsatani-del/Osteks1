import React from "react";
import { Info } from "lucide-react";
import { formatEUR, formatNumber } from "../format";

const ForInformation = ({ offerPricePerM2, offerRevenuePerCarrier, offerPricePerKg }) => {
  return (
    <div className="calc-card">
      <div className="calc-card-header">
        <span className="calc-card-icon calc-card-icon--blue-soft">
          <Info size={16} />
        </span>
        <h3 className="calc-card-title">For information (based on the quoted price)</h3>
      </div>

      <div className="calc-info-list">
        <div className="calc-info-row">
          <span>Angebotspreis pro m²</span>
          <strong>{formatNumber(offerPricePerM2, 2, " €")}</strong>
        </div>

        <div className="calc-info-row">
          <span>AngebotsUmsatz/Warenträger</span>
          <strong>{formatEUR(offerRevenuePerCarrier)}</strong>
        </div>

        <div className="calc-info-row">
          <span>AngebotsPreis/kg</span>
          <strong>{formatNumber(offerPricePerKg, 2, " €")}</strong>
        </div>
      </div>
    </div>
  );
};

export default ForInformation;
