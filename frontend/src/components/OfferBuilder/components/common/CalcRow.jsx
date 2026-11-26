import React from "react";

// One line of a calculation: label and value - and, for the machine-hour
// breakdown, its share of the price. The Excel cell is not shown; like the
// form fields it is kept as a tooltip ("Excel: F32"), so a number can still
// be checked against the sheet.
const CalcRow = ({ label, cell, value, share, strong = false, muted = false }) => (
  <div className={`crow ${strong ? "is-strong" : ""} ${muted ? "is-muted" : ""}`} title={cell ? `Excel: ${cell}` : undefined}>
    <span className="crow-label">{label}</span>
    {share !== undefined && <span className="crow-share">{share}</span>}
    <span className="crow-value">{value}</span>
  </div>
);

export default CalcRow;
