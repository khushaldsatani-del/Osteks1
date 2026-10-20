import { DEFAULT_MASTER_PARTS, DEFAULT_SETTINGS } from "./settingsData";

// Settings and the part master data are kept in this browser's
// localStorage until there is a shift-planning backend (same approach as
// the plan and the production reports). Saves return false when storage is
// unavailable so the page can say so.

const SETTINGS_KEY = "shiftSettings";
const PARTS_KEY = "partMasterData";

const clone = (value) => JSON.parse(JSON.stringify(value));

export const loadSettings = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY));
    if (saved) {
      return {
        capacity: { ...clone(DEFAULT_SETTINGS.capacity), ...saved.capacity },
        workingDays: Array.isArray(saved.workingDays) ? saved.workingDays : [...DEFAULT_SETTINGS.workingDays],
        shiftTimes: { ...clone(DEFAULT_SETTINGS.shiftTimes), ...saved.shiftTimes },
      };
    }
  } catch {
    // unreadable or unavailable - use the defaults
  }
  return clone(DEFAULT_SETTINGS);
};

export const saveSettings = (settings) => {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
};

export const loadMasterParts = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PARTS_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    // unreadable or unavailable - use the defaults
  }
  return clone(DEFAULT_MASTER_PARTS);
};

export const saveMasterParts = (parts) => {
  try {
    window.localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
    return true;
  } catch {
    return false;
  }
};
