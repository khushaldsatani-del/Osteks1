// Number and date formatting shared by the Shift Planning pages.
// English uses 14.4 / 1,200, German 14,4 / 1.200.

const LOCALES = { EN: "en-US", DE: "de-DE" };
const localeOf = (language) => LOCALES[language] ?? LOCALES.EN;
const pad = (n) => String(n).padStart(2, "0");

export const formatNumber = (language, n) => new Intl.NumberFormat(localeOf(language)).format(n);

// One decimal place, always shown ("8.0 / 20 t").
export const formatTons = (language, n) =>
  new Intl.NumberFormat(localeOf(language), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

// Same, with a "+" on positive values so they read as a change.
export const formatSignedTons = (language, n) => `${n > 0 ? "+" : ""}${formatTons(language, n)}`;

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const formatDateDots = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

// "Tue, 06 Oct 2026" / "Di., 06. Okt. 2026"
export const formatShortDate = (language, d) => {
  const locale = language === "DE" ? "de-DE" : "en-GB";
  const weekday = d.toLocaleDateString(locale, { weekday: "short" });
  const month = d.toLocaleDateString(locale, { month: "short" });
  const day = language === "DE" ? `${pad(d.getDate())}.` : pad(d.getDate());
  return `${weekday}, ${day} ${month} ${d.getFullYear()}`;
};

// <input type="date"> value <-> local Date (no time-zone shift).
export const toIsoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIsoDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// "06.10.2026 08:24"
export const formatDateTimeDots = (d) => `${formatDateDots(d)} ${formatTime(d)}`;

// "2.1 MB" / "2,1 MB"; small files in KB.
export const formatFileSize = (language, bytes) => {
  if (bytes < 1024 * 1024) return `${formatNumber(language, Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${formatTons(language, bytes / (1024 * 1024))} MB`;
};

// Euro amounts with cents, no symbol (the column says "(€)"): 62,500.00 / 62.500,00
export const formatMoney = (language, n) =>
  new Intl.NumberFormat(localeOf(language), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
