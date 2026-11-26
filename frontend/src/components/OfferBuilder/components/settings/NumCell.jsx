import React from "react";
import NumberInput from "../common/NumberInput";

// A number in a settings table or list, written in the language's style
// (1,50,000 / 150.000) and taken over when the box is left (or Enter).
// `percent` shows 0.75 as 75 and stores it back as 0.75. `percentSign` =
// false leaves the "%" to the caller (the settings list shows units in a
// column of their own, so every box lines up).
const NumCell = ({ value, onChange, percent = false, percentSign = true, label, width = 90 }) => {
  const shown = percent ? Math.round(value * 10000) / 100 : value;
  return (
    <span className="numcell" style={{ width }}>
      <NumberInput
        aria-label={label}
        value={shown}
        commitOnBlur
        onChange={(next) => onChange(percent ? next / 100 : next)}
      />
      {percent && percentSign && <em>%</em>}
    </span>
  );
};

export default NumCell;
