import React from "react";
import { Check } from "lucide-react";

// The teal checkbox-style toggle used across the 8D wizard (Complaint
// Accepted/Rejected, the "parts affected?" rows).
const CheckboxOption = ({ checked, onToggle, label }) => (
  <span
    role="checkbox"
    tabIndex={0}
    aria-checked={checked}
    className={`eightd-checkbox-option ${checked ? "checked" : ""}`}
    onClick={onToggle}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onToggle();
      }
    }}
  >
    <span className="eightd-checkbox-box">{checked && <Check size={13} strokeWidth={3} />}</span>
    {label}
  </span>
);

export default CheckboxOption;
