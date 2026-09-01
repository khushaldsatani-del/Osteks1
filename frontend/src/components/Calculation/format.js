// Small formatting helpers shared by every Calculation card.
// Numbers are displayed the way the source spreadsheet shows them:
// German locale (comma as decimal separator) with a trailing unit.

export const formatEUR = (value, decimals = 2) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return `0,${"0".repeat(decimals)} €`;
  return `${num.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} €`;
};

export const formatNumber = (value, decimals = 0, suffix = "") => {
  const num = Number(value);
  if (!Number.isFinite(num)) return `0${suffix}`;
  return `${num.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
};

// Formats a plain digit string using the German numbering system (groups of
// 3 from the right, period as the thousands separator — e.g. "150000" ->
// "150.000"). Used for live formatting while typing, so it works on raw
// digits rather than a number. Replaces the app's old Indian-style grouping
// (5,20,000) everywhere a plain integer count is shown — see formatGermanLive
// below for the decimal-aware version.
export const formatGermanDigits = (digits) => {
  if (!digits) return "";
  const clean = String(digits).replace(/\D/g, "");
  if (!clean) return "";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Strips a raw typed string down to digits and at most one decimal point —
// e.g. "13.268,5x" -> "13268.5". A comma is treated exactly like a period
// (the natural decimal key on a German keyboard/input); the stored value
// itself always keeps "." as its decimal separator regardless of which one
// was typed, so Number(value) and the rest of the calculation engine are
// unaffected — only the live/formatted DISPLAY (formatGermanLive, formatEUR,
// formatNumber) shows it the German way (comma decimal, period thousands).
export const cleanNumericInput = (raw) => {
  let str = String(raw ?? "").replace(",", ".").replace(/[^\d.]/g, "");
  const firstDot = str.indexOf(".");
  if (firstDot !== -1) {
    str = str.slice(0, firstDot + 1) + str.slice(firstDot + 1).replace(/\./g, "");
  }
  return str;
};

// Live German-grouped display for a raw numeric string that may include
// decimals — e.g. "1352153" -> "1.352.153", "190.5" -> "190,5" (the integer
// part is grouped with periods, the decimal part follows a comma).
export const formatGermanLive = (raw) => {
  const clean = cleanNumericInput(raw);
  if (!clean) return "";
  const [intPart, decPart] = clean.split(".");
  const groupedInt = formatGermanDigits(intPart);
  return decPart === undefined ? groupedInt : `${groupedInt},${decPart}`;
};
