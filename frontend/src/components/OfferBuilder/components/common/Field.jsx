import React from "react";
import NumberInput from "./NumberInput";

// One input with its label and unit. The Excel cell it stands for is kept
// as a tooltip ("Excel: B3") - visible in the calculation details, but not
// cluttering the form. A number field (the default) is a NumberInput:
// written in the language's style (1,50,000 / 150.000) while typing,
// handing on the plain number; text, date and read-only fields stay plain.
const Field = ({ label, cell, unit, value, onChange, numeric = true, placeholder, hint, wide = false, readOnly = false, type, invalid = false }) => {
  const asNumber = numeric && !readOnly && !type;
  return (
    <label className={`fld ${wide ? "fld--wide" : ""}`} title={cell ? `Excel: ${cell}` : undefined}>
      <span className="fld-label">{label}</span>
      <span className={`fld-box ${readOnly ? "is-readonly" : ""} ${invalid ? "is-invalid" : ""}`}>
        {asNumber ? (
          <NumberInput value={value} onChange={onChange} placeholder={placeholder} aria-invalid={invalid || undefined} />
        ) : (
          <input
            value={value ?? ""}
            onChange={(event) => onChange?.(event.target.value)}
            aria-invalid={invalid || undefined}
            placeholder={placeholder}
            readOnly={readOnly}
            tabIndex={readOnly ? -1 : undefined}
            type={type}
          />
        )}
        {unit && <span className="fld-unit">{unit}</span>}
      </span>
      {hint && <span className="fld-hint">{hint}</span>}
    </label>
  );
};

export default Field;
