// Pure helpers for the backlog dashboard: grouping the daily values into
// weeks / months, range presets, the y-axis scale and formatting.
//
// A week's or month's value is the AVERAGE of its working days (Mo-Fr)
// that have a value - exactly what Excel's status bar shows when the day
// cells of a week are selected (user's choice, 26.11.2026; replaced the
// sum of all 7 days). Saturday/Sunday are left out (Sunday is only a copy
// of Saturday). Single days are not charted: the real daily numbers are
// in the workbook, the app shows only averages.

export const CATEGORIES = [
  { key: "ktl", label: "KTL", color: "#7b93ff" },
  { key: "pulver", label: "Pulver", color: "#cfa6fb" },
  { key: "schaeumen", label: "Schäumen", color: "#9b51fa" },
];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export const GRANULARITIES = ["week", "month"];
export const RANGE_PRESETS = ["4w", "3m", "6m", "ytd", "all"];

const pad = (n) => String(n).padStart(2, "0");
// en-US: "Sep '26" (en-GB would give "Sept")
const LOCALES = { EN: "en-US", DE: "de-DE" };

export const parseIso = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// ISO 8601 week: weeks start on Monday, week 1 holds the year's first Thursday.
export function isoWeek(date) {
  const thursday = addDays(date, 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const week = 1 + Math.round(((thursday - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return { year: thursday.getFullYear(), week };
}

const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));

const isWorkingDay = (date) => date.getDay() !== 0 && date.getDay() !== 6;

// One bucket per ISO week / month, averaged over its working days with a
// value. A week crossing two months stays whole in week view; month view
// counts only the month's own days. start/end are the calendar bounds for
// the caption (Mo-Fr for a week, 1st-last for a month), dayCount how many
// working days were averaged, lastDate the newest of them. The total of
// the categories' averages equals the average of the daily totals, because
// the backend only sends days that have all three categories.
export function groupDays(days, granularity) {
  const buckets = new Map();
  for (const day of days) {
    const date = parseIso(day.date);
    if (!isWorkingDay(date)) continue;
    let key;
    let start;
    let end;
    if (granularity === "week") {
      const { year, week } = isoWeek(date);
      key = `${year}-W${pad(week)}`;
      start = mondayOf(date);
      end = addDays(start, 4);
    } else {
      key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }
    const bucket = buckets.get(key) ?? { key, start, end, dayCount: 0, ktl: 0, pulver: 0, schaeumen: 0 };
    bucket.ktl += day.ktl;
    bucket.pulver += day.pulver;
    bucket.schaeumen += day.schaeumen;
    bucket.dayCount += 1;
    bucket.lastDate = date;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    ktl: bucket.ktl / bucket.dayCount,
    pulver: bucket.pulver / bucket.dayCount,
    schaeumen: bucket.schaeumen / bucket.dayCount,
  }));
}

// The periods to chart for a range: whole weeks/months that overlap it, so
// the first bar is never the average of only part of its week just because
// of where the range starts (the newest week stays partial until its days
// are in the file).
export function periodsInRange(days, granularity, from, to) {
  return groupDays(days, granularity).filter((p) => toIso(p.end) >= from && toIso(p.start) <= to);
}

// The view with no filter applied: the newest 5 calendar weeks or 5 months.
export const DEFAULT_PERIOD_COUNT = { week: 5, month: 5 };

export function defaultView(days, granularity, lastIso) {
  const periods = groupDays(days, granularity).slice(-DEFAULT_PERIOD_COUNT[granularity]);
  return { periods, range: { from: periods.length ? toIso(periods[0].start) : lastIso, to: lastIso } };
}

export function periodLabel(period, granularity, language, withYear) {
  const locale = LOCALES[language] ?? LOCALES.EN;
  if (granularity === "week") {
    const { year, week } = isoWeek(period.start);
    return withYear ? `KW ${pad(week)} '${String(year).slice(2)}` : `KW ${pad(week)}`;
  }
  const month = period.start.toLocaleDateString(locale, { month: "short" }).replace(".", "");
  return `${month} '${String(period.start.getFullYear()).slice(2)}`;
}

export const formatDots = (d, withYear = true) =>
  `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${withYear ? d.getFullYear() : ""}`;

// "12.10. – 16.10.2026" for a week (Mo-Fr), "01.10. – 31.10.2026" for a
// month.
export function periodRange(period) {
  return `${formatDots(period.start, false)} – ${formatDots(period.end)}`;
}

export const sumOf = (period, selected) => selected.reduce((total, key) => total + (period?.[key] ?? 0), 0);

// Range presets end at the newest stored day, not "today", so the chart
// is never padded with days that have no data yet.
export function presetRange(preset, firstIso, lastIso) {
  const last = parseIso(lastIso);
  const first = parseIso(firstIso);
  let from;
  if (preset === "4w") from = addDays(mondayOf(last), -21);
  else if (preset === "3m") from = new Date(last.getFullYear(), last.getMonth() - 2, 1);
  else if (preset === "6m") from = new Date(last.getFullYear(), last.getMonth() - 5, 1);
  else if (preset === "ytd") from = new Date(last.getFullYear(), 0, 1);
  else from = first;
  return { from: toIso(from < first ? first : from), to: lastIso };
}

// A "nice" axis: 0 to a round maximum just above the data, in 5-8 steps of
// 1/2/2.5/5 x 10^n (e.g. 0-450 in steps of 50).
export function niceScale(max) {
  if (!(max > 0)) return { max: 100, ticks: [0, 25, 50, 75, 100] };
  const rough = (max * 1.08) / 7;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= rough);
  const top = Math.ceil((max * 1.04) / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { max: top, ticks };
}

// Whole T€ by default, like the workbook ("405 T€").
export const formatAmount = (language, n, digits = 0) =>
  new Intl.NumberFormat(language === "DE" ? "de-DE" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);

export const formatPercent = (language, ratio, digits = 0) =>
  `${new Intl.NumberFormat(language === "DE" ? "de-DE" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio * 100)}%`;
