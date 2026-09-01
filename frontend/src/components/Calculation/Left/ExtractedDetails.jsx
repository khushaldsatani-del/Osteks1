import React, { useState } from "react";
import { Archive } from "lucide-react";
import CustomSelect from "../../common/CustomSelect";
import { formatGermanDigits, formatGermanLive, cleanNumericInput } from "../format";
import { useTranslation } from "../../../i18n/LanguageContext";

const ExtractedDetails = ({ values, onChange, onBlur }) => {
  const { t } = useTranslation();
  const set = (field) => (event) => onChange(field, event.target.value);
  const setNumeric = (field) => (event) => onChange(field, cleanNumericInput(event.target.value));

  // German-formatted whenever a field isn't the one actively being typed
  // into — while focused, the raw stored digits show instead, so a live
  // grouping/decimal separator inserted mid-typing never gets the chance to
  // shift the cursor and swallow or misplace a keystroke (this is what was
  // causing e.g. a typed "50000" to sometimes end up stored as just "5").
  const [focusedField, setFocusedField] = useState(null);
  const focus = (field) => () => setFocusedField(field);
  const displayLive = (field) => (focusedField === field ? values[field] : formatGermanLive(values[field]));
  const displayDigits = (field) => (focusedField === field ? values[field] : formatGermanDigits(values[field]));

  // `value` (fed into the calculation engine / saved to the DB) stays fixed
  // regardless of language — only `label` (what the dropdown displays)
  // translates.
  const densityOptions = [
    { value: "7.85", label: t("extractedDetails.materialSteelOption") },
    { value: "2.70", label: t("extractedDetails.materialAluminiumOption") },
  ];

  const jnOptions = [
    { value: "j", label: t("extractedDetails.optionYes") },
    { value: "n", label: t("extractedDetails.optionNo") },
  ];

  return (
    <div className="calc-card calc-card--grow">
      <div className="calc-card-header">
        <span className="calc-card-icon calc-card-icon--blue">
          <Archive size={16} />
        </span>
        <h3 className="calc-card-title">{t("extractedDetails.title")}</h3>
      </div>

      <div className="calc-form-grid">
        <div className="calc-field">
          <label htmlFor="weight">{t("extractedDetails.weight")}</label>
          <div className="calc-input-unit">
            <input
              id="weight"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={displayLive("weightG")}
              onChange={(event) => onChange("weightG", cleanNumericInput(event.target.value))}
              onFocus={focus("weightG")}
              onBlur={() => setFocusedField(null)}
            />
            <span>g</span>
          </div>
        </div>

        <div className="calc-field">
          <label htmlFor="thickness">{t("extractedDetails.coatingThickness")}</label>
          <div className="calc-input-unit">
            <input
              id="thickness"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={displayLive("thicknessMm")}
              onChange={setNumeric("thicknessMm")}
              onFocus={focus("thicknessMm")}
              onBlur={() => setFocusedField(null)}
            />
            <span>mm</span>
          </div>
        </div>

        <div className="calc-field calc-field--full">
          <label htmlFor="density">{t("extractedDetails.specWeight")}</label>
          <CustomSelect
            id="density"
            value={values.densityGcm3}
            onChange={(value) => onChange("densityGcm3", value)}
            options={densityOptions}
            placeholder={t("extractedDetails.selectMaterial")}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="surfaceMm2">{t("extractedDetails.surfaceAreaMm2")}</label>
          <div className="calc-input-unit">
            <input
              id="surfaceMm2"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={displayLive("surfaceAreaMm2")}
              onChange={(event) => onChange("surfaceAreaMm2", cleanNumericInput(event.target.value))}
              onFocus={focus("surfaceAreaMm2")}
              onBlur={() => {
                setFocusedField(null);
                onBlur("surfaceAreaMm2");
              }}
            />
            <span>mm²</span>
          </div>
        </div>

        <div className="calc-field">
          <label htmlFor="surfaceM2">{t("extractedDetails.surfaceAreaM2")}</label>
          <div className="calc-input-unit">
            <input
              id="surfaceM2"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={displayLive("surfaceAreaM2")}
              onChange={setNumeric("surfaceAreaM2")}
              onFocus={focus("surfaceAreaM2")}
              onBlur={() => {
                setFocusedField(null);
                onBlur("surfaceAreaM2");
              }}
            />
            <span>m²</span>
          </div>
        </div>

        <div className="calc-field">
          <label htmlFor="schichtdicke">{t("extractedDetails.schichtdicke")}</label>
          <input
            id="schichtdicke"
            type="text"
            placeholder={t("extractedDetails.schichtdickePlaceholder")}
            value={values.schichtdickeUm}
            onChange={set("schichtdickeUm")}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="quantity">{t("extractedDetails.quantity")}</label>
          <input
            id="quantity"
            type="text"
            inputMode="numeric"
            placeholder={t("extractedDetails.enterQuantity")}
            value={displayDigits("quantity")}
            onChange={(event) => onChange("quantity", event.target.value.replace(/\D/g, ""))}
            onFocus={focus("quantity")}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="beizen">{t("extractedDetails.beizen")}</label>
          <CustomSelect
            id="beizen"
            value={values.beizenJN}
            onChange={(value) => onChange("beizenJN", value)}
            options={jnOptions}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="gussteil">{t("extractedDetails.gussteil")}</label>
          <CustomSelect
            id="gussteil"
            value={values.gussteilJN}
            onChange={(value) => onChange("gussteilJN", value)}
            options={jnOptions}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="gusszuschlag">{t("extractedDetails.gusszuschlagPercent")}</label>
          <div className="calc-input-unit">
            <input
              id="gusszuschlag"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={displayLive("gusszuschlagPercent")}
              onChange={setNumeric("gusszuschlagPercent")}
              onFocus={focus("gusszuschlagPercent")}
              onBlur={() => setFocusedField(null)}
            />
            <span>%</span>
          </div>
        </div>

        <div className="calc-field">
          <label htmlFor="maskierung">{t("extractedDetails.maskierungenStueck")}</label>
          <div className="calc-input-unit">
            <input
              id="maskierung"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={displayLive("maskierungStueck")}
              onChange={setNumeric("maskierungStueck")}
              onFocus={focus("maskierungStueck")}
              onBlur={() => setFocusedField(null)}
            />
            <span>{t("common.unitPieces")}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtractedDetails;
