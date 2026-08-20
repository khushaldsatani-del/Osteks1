import React from "react";
import { Grid2x2 } from "lucide-react";
import { cleanNumericInput } from "../format";

const WEIGHT_PER_CARRIER_LIMIT_KG = 695;

const PricingAnalysis = ({ values, onChange, onBlur, notes, onNotesChange }) => {
  const set = (field) => (event) => onChange(field, cleanNumericInput(event.target.value));
  const blur = (field) => () => onBlur(field);

  const isOverWeightLimit = Number(values.weightPerCarrierKg) > WEIGHT_PER_CARRIER_LIMIT_KG;

  return (
    <div className="calc-card calc-card--grow">
      <div className="calc-card-header">
        <span className="calc-card-icon calc-card-icon--purple">
          <Grid2x2 size={16} />
        </span>
        <h3 className="calc-card-title">Pricing Analysis &amp; Machine Loading</h3>
      </div>

      <div className="calc-list">
        <div className="calc-list-row">
          <span>Oberfläche je Warenträger</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={values.carrierSurfaceM2}
              onChange={set("carrierSurfaceM2")}
              onBlur={blur("carrierSurfaceM2")}
            />
            <span>m²</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>Stück pro Warenträger</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={values.partsPerCarrier}
              onChange={set("partsPerCarrier")}
              onBlur={blur("partsPerCarrier")}
            />
            <span>Stk</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>Preis pro Teil</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={values.basePricePerPart}
              onChange={set("basePricePerPart")}
              onBlur={blur("basePricePerPart")}
            />
            <span>€</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>Beizen (25c/m²)</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={values.picklingCost}
              onChange={set("picklingCost")}
              onBlur={blur("picklingCost")}
            />
            <span>€</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>Maskierung pro Teil (0,10ct/Teil)</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={values.maskingCost}
              onChange={set("maskingCost")}
              onBlur={blur("maskingCost")}
            />
            <span>€</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>Gußzuschlag</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={values.castingSurcharge}
              onChange={set("castingSurcharge")}
              onBlur={blur("castingSurcharge")}
            />
            <span>€</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>Summe</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={values.totalPrice}
              onChange={set("totalPrice")}
              onBlur={blur("totalPrice")}
            />
            <span>€</span>
          </div>
        </div>

        <div className="calc-list-row">
          <span>zzgl. ETZ</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={values.etzPercent}
              onChange={set("etzPercent")}
              onBlur={blur("etzPercent")}
            />
            <span>%</span>
          </div>
        </div>

        <div className="calc-list-row calc-list-row--highlight">
          <span>Kalkulierter Preis</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={values.kalkulierterPreis}
              onChange={set("kalkulierterPreis")}
              onBlur={blur("kalkulierterPreis")}
            />
            <span>€</span>
          </div>
        </div>

        <div className={`calc-list-row ${isOverWeightLimit ? "calc-list-row--warning" : ""}`}>
          <span>Gewicht pro Warenträger in kg</span>
          <div className="calc-inline-input">
            <input
              type="text"
              inputMode="decimal"
              value={values.weightPerCarrierKg}
              onChange={set("weightPerCarrierKg")}
              onBlur={blur("weightPerCarrierKg")}
            />
            <span>kg</span>
          </div>
        </div>

        <div className="calc-list-row calc-list-row--solid">
          <span>Angebotspreis</span>
          <div className="calc-inline-input calc-inline-input--solid">
            <input
              type="text"
              inputMode="decimal"
              value={values.offerPrice}
              onChange={set("offerPrice")}
              onBlur={blur("offerPrice")}
            />
            <span>€</span>
          </div>
        </div>
      </div>

      <textarea
        className="calc-notes"
        placeholder="Notes..."
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
      />
    </div>
  );
};

export default PricingAnalysis;
