import React from "react";

// A small row of buttons where exactly one is chosen (D-KTL / N-KTL,
// Ja / Nein, the tabs of a panel).
const Segmented = ({ options, value, onChange, size = "md", label }) => (
  <div className={`seg seg--${size}`} role="radiogroup" aria-label={label}>
    {options.map((option) => {
      const Icon = option.icon;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? "is-on" : ""}
          onClick={() => onChange(option.value)}
        >
          {Icon && <Icon size={size === "lg" ? 16 : 14} />}
          {option.label}
        </button>
      );
    })}
  </div>
);

export default Segmented;
