import React from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { SHIFT_DEFS } from "../Planning/planningData";

// Shift picker styled like the labelled date button: a native <select>
// laid invisibly over the button face, so keyboard and screen readers get
// the browser's own select.
const ShiftSelect = ({ value, onChange }) => {
  const { t } = useTranslation();
  const shift = SHIFT_DEFS.find((s) => s.id === value) ?? SHIFT_DEFS[0];
  const Icon = shift.icon;

  return (
    <label className={`sp-date-button sp-date-button--labelled prep-shift-select prep-shift-select--${shift.id}`}>
      <Icon size={16} className="prep-shift-select-icon" />
      <span className="sp-field-text">
        <span className="sp-field-label">{t("shiftReport.shift")}</span>
        <span className="sp-field-value">
          {shift.name} ({shift.from} – {shift.to})
        </span>
      </span>
      <ChevronDown size={15} className="sp-date-chevron" />
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={t("shiftReport.shift")}>
        {SHIFT_DEFS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.from} – {s.to})
          </option>
        ))}
      </select>
    </label>
  );
};

export default ShiftSelect;
