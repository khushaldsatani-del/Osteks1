// Pure helpers for the backlog dashboard: grouping the daily values into
// days / weeks / months, range presets, the y-axis scale and formatting.
//
// A week's or month's value is the SUM of all its stored days, weekend
// included (the user's choice, 20.10.2026) - so KW 42 = 12.10. + ... +
// 18.10. Day view shows each working day on its own.

export const CATEGORIES = [
  { key: "ktl", label: "KTL", color: "#7b93ff" },
  { key: "pulver", label: "Pulver", color: "#cfa6fb" },
  { key: "schaeumen", label: "Schäumen", color: "#9b51fa" },
];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export const GRANULARITIES = ["day", "week", "month"];
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

// Saturdays and Sundays the workbook only copied from Friday. Day view
// leaves them out (flat repeats); a Monday that happens to equal the
// weekend is a real working day and stays.
export const isWeekendCopy = (day) => {
  const weekday = parseIso(day.date).getDay();
  return day.carryForward && (weekday === 0 || weekday === 6);
};

// One bucket per day / ISO week / month. start/end are the calendar bounds
// (for the "12.10. – 18.10." caption), dayCount how many stored days were
// added up, lastDate the newest of them.
export function groupDays(days, granularity) {
  const buckets = new Map();
  for (const day of days) {
    if (granularity === "day" && isWeekendCopy(day)) continue;
    const date = parseIso(day.date);
    let key;
    let start;
    let end;
    if (granularity === "day") {
      key = day.date;
      start = end = date;
    } else if (granularity === "week") {
      const { year, week } = isoWeek(date);
      key = `${year}-W${pad(week)}`;
      start = mondayOf(date);
      end = addDays(start, 6);
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
  return [...buckets.values()];
}

// The periods to chart for a range: whole weeks/months that overlap it, so
// the first bar is never the sum of only part of its week just because of
// where the range starts (the newest week stays partial until its days are
// in the file).
export function periodsInRange(days, granularity, from, to) {
  return groupDays(days, granularity).filter((p) => toIso(p.end) >= from && toIso(p.start) <= to);
}

// The view with no filter applied: the newest 7 days (working days - the
// weekend copies are not counted), 5 calendar weeks or 5 months.
export const DEFAULT_PERIOD_COUNT = { day: 7, week: 5, month: 5 };

export function defaultView(days, granularity, lastIso) {
  const periods = groupDays(days, granularity).slice(-DEFAULT_PERIOD_COUNT[granularity]);
  return { periods, range: { from: periods.length ? toIso(periods[0].start) : lastIso, to: lastIso } };
}

export function periodLabel(period, granularity, language, withYear) {
  const locale = LOCALES[language] ?? LOCALES.EN;
  if (granularity === "day") {
    const d = period.start;
    return withYear ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}` : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
  }
  if (granularity === "week") {
    const { year, week } = isoWeek(period.start);
    return withYear ? `KW ${pad(week)} '${String(year).slice(2)}` : `KW ${pad(week)}`;
  }
  const month = period.start.toLocaleDateString(locale, { month: "short" }).replace(".", "");
  return `${month} '${String(period.start.getFullYear()).slice(2)}`;
}

export const formatDots = (d, withYear = true) =>
  `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${withYear ? d.getFullYear() : ""}`;

// "12.10. – 18.10.2026" for a week, "01.10. – 31.10.2026" for a month,
// "19.10.2026" for a day.
export function periodRange(period, granularity) {
  if (granularity === "day") return formatDots(period.start);
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
