import { CalendarDays, CalendarX, ClipboardList, Clock, FileX, Moon, Sun, TriangleAlert, UserX } from "lucide-react";

// Sample figures for the Shift Planning dashboard, taken from the approved
// mock-up. There is no shift-planning backend yet - when there is, these are
// replaced by API data of the same shape. Dates are stored as an offset from
// the date picked in the page header (0 = that day, -1 = the day before), so
// the page always reads as that day's overview.

// Production lines (the plant has two). Colours live in shiftDashboard.css
// (.sdash-line--<id>).
export const LINES = [
  { id: "ktl", name: "KTL" },
  { id: "pulver", name: "Pulver" },
];

// Capacity of one line in one shift, in tonnes.
export const LINE_CAPACITY_T = 20;

// Tonnes planned per line in each shift.
export const SHIFTS = [
  { number: 1, from: "06:00", to: "14:00", icon: Sun, tone: "day", load: { ktl: 14.4, pulver: 11.6 } },
  { number: 2, from: "14:00", to: "22:00", icon: Sun, tone: "day", load: { ktl: 17.2, pulver: 13.0 } },
  { number: 3, from: "22:00", to: "06:00", icon: Moon, tone: "night", load: { ktl: 9.0, pulver: 6.0 } },
];

// Warning types: icon and colour of the Type column.
export const WARNING_TYPES = {
  plannedTwice: { icon: CalendarX, tone: "red" },
  noOrder: { icon: UserX, tone: "amber" },
  reportMissing: { icon: FileX, tone: "red" },
  dueSoon: { icon: Clock, tone: "amber" },
};

// The card shows the first WARNINGS_SHOWN rows; "View all" shows the rest.
// `descKey` is a shiftDashboard.* translation, filled with `descVars`.
export const WARNINGS_SHOWN = 5;
export const WARNINGS = [
  { id: 1, type: "plannedTwice", part: "T03434", descKey: "descPlannedInShifts", descVars: { a: 1, b: 2 }, dayOffset: 0, critical: true },
  { id: 2, type: "noOrder", part: "T02218-s01", descKey: "descNoOrder", dayOffset: 0 },
  { id: 3, type: "reportMissing", part: "T04175", descKey: "descReportMissing", dayOffset: -1 },
  { id: 4, type: "dueSoon", part: "T04176", descKey: "descDueInDays", descVars: { days: 2 }, dayOffset: 2 },
  { id: 5, type: "plannedTwice", part: "710746S00E", descKey: "descPlannedInShifts", descVars: { a: 2, b: 3 }, dayOffset: 0, critical: true },
  { id: 6, type: "dueSoon", part: "T03351", descKey: "descDueInDays", descVars: { days: 4 }, dayOffset: 4 },
];

// Key figures along the top. The Warnings figure counts WARNINGS above.
export const KEY_FIGURES = [
  { id: "overdue", tone: "red", icon: Clock, value: 8, note: { key: "overdueNote", vars: { count: 3 }, tone: "red" } },
  { id: "dueSoon", tone: "amber", icon: CalendarDays, value: 24, note: { key: "dueSoonNote", vars: { count: 12 }, tone: "amber" } },
  { id: "plannedToday", tone: "teal", icon: ClipboardList, value: 18, note: { key: "plannedTodayNote", tons: 42.5, tone: "muted" } },
  { id: "warnings", tone: "red", icon: TriangleAlert },
];

// Yesterday's planned vs coated tonnes per line. Totals are calculated.
export const YESTERDAY = [
  { line: "ktl", planned: 28.0, coated: 26.5 },
  { line: "pulver", planned: 18.0, coated: 15.2 },
];

// Y axis of the yesterday chart, in tonnes.
export const CHART_MAX_T = 30;
export const CHART_TICKS = [30, 20, 10, 0];
