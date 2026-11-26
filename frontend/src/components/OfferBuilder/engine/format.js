// Number and date formats in the chosen language (set by LanguageProvider):
// German 1.234,5678 € / English €1,234.5678. null (an Excel #DIV/0!) prints
// as "–".
let locale = "de-DE";
export const setFormatLocale = (next) => {
  locale = next;
};

const nf = (digits) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const eur = (v, digits = 4) =>
  v == null || !Number.isFinite(v)
    ? "–"
    : new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
export const num = (v, digits = 0) => (v == null || !Number.isFinite(v) ? "–" : nf(digits).format(v));
export const pct = (v, digits = 1) => (v == null || !Number.isFinite(v) ? "–" : `${nf(digits).format(v * 100)} %`);

// "12. November 2026" / "12 November 2026"
export const longDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
};

// "24.08.2026" / "24/08/2026"
export const shortDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
};

// the decimal mark of the chosen language, for placeholders ("0,23" / "0.23")
export const decimal = (v, digits = 2) => nf(digits).format(v);

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const addDaysIso = (iso, days) => {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(y, m - 1, d + days);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export const addMonthsIso = (iso, months) => {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(y, m - 1 + months, d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

// A typed number in either style: "0,4" / "0.4", "10.000" (German
// thousands) / "10,000" (English thousands), "1.234,5" / "1,234.5".
// Real numbers (the settings) are taken as they are, and "0.395" is never
// read as thousands - only a group that starts with 1-9 is.
// A per-part value that falls back to the setting while its field is empty
// - a cleared field means "use the default", not 0.
export const numOr = (value, fallback) => (value == null || String(value).trim() === "" ? parseNum(fallback) : parseNum(value));

export const parseNum = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let s = String(value ?? "").trim().replace(/\s/g, "");
  if (!s) return 0;
  if (/^-?[1-9]\d?(,\d{2})+,\d{3}(\.\d+)?$/.test(s)) s = s.replace(/,/g, ""); // 1,50,000 (Indian grouping, as Excel shows it here)
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); // 10.000 / 1.234,5
  else if (/^-?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ""); // 10,000 / 1,234.5
  else s = s.replace(",", "."); // 0,4
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
