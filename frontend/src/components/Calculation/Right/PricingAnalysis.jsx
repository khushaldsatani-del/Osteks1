import React, { useState } from "react";
import { Grid2x2 } from "lucide-react";
import { cleanNumericInput, formatGermanLive } from "../format";
import { useTranslation } from "../../../i18n/LanguageContext";

const WEIGHT_PER_CARRIER_LIMIT_KG = 695;

const PricingAnalysis = ({ values, onChange, onBlur, notes, onNotesChange }) => {
  const { t } = useTranslation();
  const set = (field) => (event) => onChange(field, cleanNumericInput(event.target.value));

  // German-formatted (1.234,56 style) whenever a field ISN'T the one being
  // actively typed into — while focused, the raw stored digits show
  // instead, so inserting a "." or "," grouping separator mid-typing never
  // has a chance to shift the cursor and swallow/misplace a keystroke. Same
  // pattern as ExtractedDetails.jsx / OfferDetails.jsx.
  const [focusedField, setFocusedField] = useState(null);
  const display = (field) => (focusedField === field ? values[field] : formatGermanLive(values[field]));
  const focus = (field) => () => setFocusedField(field);
  const blur = (field) => () => {
    setFocusedField(null);
    onBlur(field);
  };

  const isOverWeightLimit = Number(values.weightPerCarrierKg) > WEIGHT_PER_CARRIER_LIMIT_KG;

  return (
    <div className="calc-card calc-card--grow">
      <div className="calc-card-header">
        <span className="calc-card-icon calc-card-icon--purple">
          <Grid2x2 size={16} />
        </span>
        <h3 className="calc-card-title">{t("pricingAnalysis.title")}</h3>
      </div>

      <div className="calc-list">
        <div className="calc-list-row">
          <span>{t("pricingAnalysis.surfacePerCarrier")}</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={display("carrierSurfaceM2")}
              onChange={set("carrierSurfaceM2")}
              onFocus={focus("carrierSurfaceM2")}
              onBlur={blur("carrierSurfaceM2")}
            />
            <span>m²</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>{t("pricingAnalysis.partsPerCarrier")}</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={display("partsPerCarrier")}
              onChange={set("partsPerCarrier")}
              onFocus={focus("partsPerCarrier")}
              onBlur={blur("partsPerCarrier")}
            />
            <span>{t("common.unitPieces")}</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>{t("pricingAnalysis.pricePerPart")}</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={display("basePricePerPart")}
              onChange={set("basePricePerPart")}
              onFocus={focus("basePricePerPart")}
              onBlur={blur("basePricePerPart")}
            />
            <span>€</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>{t("pricingAnalysis.pickling")}</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={display("picklingCost")}
              onChange={set("picklingCost")}
              onFocus={focus("picklingCost")}
              onBlur={blur("picklingCost")}
            />
            <span>€</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>{t("pricingAnalysis.maskingPerPart")}</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={display("maskingCost")}
              onChange={set("maskingCost")}
              onFocus={focus("maskingCost")}
              onBlur={blur("maskingCost")}
            />
            <span>€</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>{t("pricingAnalysis.castingSurcharge")}</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={display("castingSurcharge")}
              onChange={set("castingSurcharge")}
              onFocus={focus("castingSurcharge")}
              onBlur={blur("castingSurcharge")}
            />
            <span>€</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>{t("pricingAnalysis.total")}</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={display("totalPrice")}
              onChange={set("totalPrice")}
              onFocus={focus("totalPrice")}
              onBlur={blur("totalPrice")}
            />
            <span>€</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>{t("pricingAnalysis.plusEtz")}</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={display("etzPercent")}
              onChange={set("etzPercent")}
              onFocus={focus("etzPercent")}
              onBlur={blur("etzPercent")}
            />
            <span>%</span>
          </div>
        </div>

        <div className="calc-list-row calc-list-row--highlight">
          <span>{t("pricingAnalysis.calculatedPrice")}</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={display("kalkulierterPreis")}
              onChange={set("kalkulierterPreis")}
              onFocus={focus("kalkulierterPreis")}
              onBlur={blur("kalkulierterPreis")}
            />
            <span>€</span>
          </div>
        </div>

        <div className={`calc-list-row ${isOverWeightLimit ? "calc-list-row--warning" : ""}`}>
          <span>{t("pricingAnalysis.weightPerCarrier")}</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={display("weightPerCarrierKg")}
              onChange={set("weightPerCarrierKg")}
              onFocus={focus("weightPerCarrierKg")}
              onBlur={blur("weightPerCarrierKg")}
            />
            <span>kg</span>
          </div>
        </div>

        <div className="calc-list-row calc-list-row--solid">
          <span>{t("pricingAnalysis.offerPrice")}</span>
          <div className="calc-inline-input calc-inline-input--solid">
            <input
              type="text"
              inputMode="decimal"
              value={display("offerPrice")}
              onChange={set("offerPrice")}
              onFocus={focus("offerPrice")}
              onBlur={blur("offerPrice")}
            />
            <span>€</span>
          </div>
        </div>
      </div>

      <textarea
        className="calc-notes"
        placeholder={t("pricingAnalysis.notesPlaceholder")}
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
      />
    </div>
  );
};

export default PricingAnalysis;
