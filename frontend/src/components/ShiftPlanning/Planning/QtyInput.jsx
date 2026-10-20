import React, { useState } from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { formatNumber } from "../shared/shiftFormat";

// Piece-count field: shows "2,000" (or "2.000"), edits as plain digits -
// anything else typed is ignored. Enter leaves the field. With `allowEmpty`
// the value may be null ("not entered yet"), shown as an empty field.
const QtyInput = ({ value, onChange, label, allowEmpty = false, className = "" }) => {
  const { language } = useTranslation();
  const [draft, setDraft] = useState(null);

  return (
    <input
      type="text"
      inputMode="numeric"
      className={`splan-qty ${className}`}
      aria-label={label}
      value={draft ?? (value == null ? "" : formatNumber(language, value))}
      onFocus={(event) => {
        const field = event.target;
        setDraft(value == null ? "" : String(value));
        requestAnimationFrame(() => field.select());
      }}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 7);
        setDraft(digits);
        onChange(digits === "" ? (allowEmpty ? null : 0) : Number(digits));
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
};

export default QtyInput;
