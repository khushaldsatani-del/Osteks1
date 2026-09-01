import React from "react";
import { Info } from "lucide-react";
import { formatEUR, formatNumber } from "../format";
import { useTranslation } from "../../../i18n/LanguageContext";

const ForInformation = ({ offerPricePerM2, offerRevenuePerCarrier, offerPricePerKg }) => {
  const { t } = useTranslation();
  return (
    <div className="calc-card">
      <div className="calc-card-header">
        <span className="calc-card-icon calc-card-icon--blue-soft">
          <Info size={16} />
        </span>
        <h3 className="calc-card-title">{t("forInformation.title")}</h3>
      </div>

      <div className="calc-info-list">
        <div className="calc-info-row">
          <span>{t("forInformation.offerPricePerM2")}</span>
          <strong>{formatNumber(offerPricePerM2, 2, " €")}</strong>
        </div>

        <div className="calc-info-row">
          <span>{t("forInformation.offerRevenuePerCarrier")}</span>
          <strong>{formatEUR(offerRevenuePerCarrier)}</strong>
        </div>

        <div className="calc-info-row">
          <span>{t("forInformation.offerPricePerKg")}</span>
          <strong>{formatNumber(offerPricePerKg, 2, " €")}</strong>
        </div>
      </div>
    </div>
  );
};

export default ForInformation;
