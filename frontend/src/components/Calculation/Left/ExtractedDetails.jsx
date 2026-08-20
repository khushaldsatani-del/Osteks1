import React from "react";
import { Archive } from "lucide-react";
import CustomSelect from "../../common/CustomSelect";
import { formatIndianDigits, formatIndianLive, cleanNumericInput } from "../format";

const DENSITY_OPTIONS = [
  { value: "7.85", label: "7.85 G/CM³ - (Steel)" },
  { value: "2.70", label: "2.70 G/CM³ - (Aluminium)" },
  { value: "8.90", label: "8.90 G/CM³ - (Copper)" },
];

const JN_OPTIONS = [
  { value: "j", label: "J" },
  { value: "n", label: "N" },
];

const ExtractedDetails = ({ values, onChange, onBlur }) => {
  const set = (field) => (event) => onChange(field, event.target.value);
  const setNumeric = (field) => (event) => onChange(field, cleanNumericInput(event.target.value));

  return (
    <div className="calc-card calc-card--grow">
      <div className="calc-card-header">
        <span className="calc-card-icon calc-card-icon--blue">
          <Archive size={16} />
        </span>
        <h3 className="calc-card-title">Extracted Details</h3>
      </div>

      <div className="calc-form-grid">
        <div className="calc-field">
          <label htmlFor="weight">Weight</label>
          <div className="calc-input-unit">
            <input
              id="weight"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={formatIndianLive(values.weightG)}
              onChange={(event) => onChange("weightG", cleanNumericInput(event.target.value))}
            />
            <span>g</span>
          </div>
        </div>

        <div className="calc-field">
          <label htmlFor="thickness">Coating Thickness</label>
          <div className="calc-input-unit">
            <input
              id="thickness"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={values.thicknessMm}
              onChange={setNumeric("thicknessMm")}
            />
            <span>mm</span>
          </div>
        </div>

        <div className="calc-field calc-field--full">
          <label htmlFor="density">Spec. Gewicht Stahl [g/cm³]</label>
          <CustomSelect
            id="density"
            value={values.densityGcm3}
            onChange={(value) => onChange("densityGcm3", value)}
            options={DENSITY_OPTIONS}
            placeholder="Select material"
          />
        </div>

        <div className="calc-field">
          <label htmlFor="surfaceMm2">Surface Area [mm²]</label>
          <div className="calc-input-unit">
            <input
              id="surfaceMm2"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={formatIndianLive(values.surfaceAreaMm2)}
              onChange={(event) => onChange("surfaceAreaMm2", cleanNumericInput(event.target.value))}
              onBlur={() => onBlur("surfaceAreaMm2")}
            />
            <span>mm²</span>
          </div>
        </div>

        <div className="calc-field">
          <label htmlFor="surfaceM2">Surface Area [m²]</label>
          <div className="calc-input-unit">
            <input
              id="surfaceM2"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={values.surfaceAreaM2}
              onChange={setNumeric("surfaceAreaM2")}
              onBlur={() => onBlur("surfaceAreaM2")}
            />
            <span>m²</span>
          </div>
        </div>

        <div className="calc-field">
          <label htmlFor="schichtdicke">Schichtdicke in µm</label>
          <input
            id="schichtdicke"
            type="text"
            placeholder="e.g. 15-30 µm"
            value={values.schichtdickeUm}
            onChange={set("schichtdickeUm")}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            type="text"
            inputMode="numeric"
            placeholder="Enter Quantity"
            value={formatIndianDigits(values.quantity)}
            onChange={(event) => onChange("quantity", event.target.value.replace(/\D/g, ""))}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="beizen">Beizen (J/N) ?</label>
          <CustomSelect
            id="beizen"
            value={values.beizenJN}
            onChange={(value) => onChange("beizenJN", value)}
            options={JN_OPTIONS}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="gussteil">Gußteil (J/N)?</label>
          <CustomSelect
            id="gussteil"
            value={values.gussteilJN}
            onChange={(value) => onChange("gussteilJN", value)}
            options={JN_OPTIONS}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="gusszuschlag">Gußzuschlag %</label>
          <div className="calc-input-unit">
            <input
              id="gusszuschlag"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={values.gusszuschlagPercent}
              onChange={setNumeric("gusszuschlagPercent")}
            />
            <span>%</span>
          </div>
        </div>

        <div className="calc-field">
          <label htmlFor="maskierung">Maskierungen Stück</label>
          <div className="calc-input-unit">
            <input
              id="maskierung"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={values.maskierungStueck}
              onChange={setNumeric("maskierungStueck")}
            />
            <span>Stk</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtractedDetails;
