// Saved production reports live in this browser's localStorage, one per day
// and shift ("productionReport:<YYYY-MM-DD>:<shift>"), until there is a
// shift-planning backend - same approach as the plan (planStorage.js).
// Storage can be unavailable; reads then return nothing and saves report
// failure so the page can say so.

const PREFIX = "productionReport:";
const keyFor = (isoDate, shiftId) => `${PREFIX}${isoDate}:${shiftId}`;

export const loadReport = (isoDate, shiftId) => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(keyFor(isoDate, shiftId)));
    return saved && typeof saved.coated === "object" ? saved : null;
  } catch {
    return null;
  }
};

// Returns true when the report was stored.
export const saveReport = (isoDate, shiftId, report) => {
  try {
    window.localStorage.setItem(keyFor(isoDate, shiftId), JSON.stringify(report));
    return true;
  } catch {
    return false;
  }
};

// Every saved report's summary: { iso, shift, planned, coated, savedAt }.
export const listReports = () => {
  const out = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const [iso, shift] = key.slice(PREFIX.length).split(":");
      const saved = JSON.parse(window.localStorage.getItem(key));
      if (saved) out.push({ iso, shift, planned: saved.planned, coated: saved.coatedTotal, savedAt: saved.savedAt });
    }
  } catch {
    // unavailable - no saved reports to list
  }
  return out;
};
