import { SAMPLE_PARTS, SAMPLE_WAITING } from "./planningData";

// A day's plan (parts + waiting list) is kept in this browser's
// localStorage under "shiftPlan:<YYYY-MM-DD>" until there is a
// shift-planning backend. A day with nothing saved starts from the sample.
// Storage can be unavailable (private mode, blocked site data) - the page
// then still works, it just doesn't remember edits.

const keyFor = (isoDate) => `shiftPlan:${isoDate}`;

const samplePlan = () => ({
  parts: SAMPLE_PARTS.map((part) => ({ ...part, plan: { ...part.plan } })),
  waiting: SAMPLE_WAITING.map((item) => ({ ...item })),
});

export const loadPlan = (isoDate) => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(keyFor(isoDate)));
    if (saved && Array.isArray(saved.parts) && Array.isArray(saved.waiting)) return saved;
  } catch {
    // unreadable or unavailable - fall back to the sample
  }
  return samplePlan();
};

export const savePlan = (isoDate, plan) => {
  try {
    window.localStorage.setItem(keyFor(isoDate), JSON.stringify({ parts: plan.parts, waiting: plan.waiting }));
  } catch {
    // storage full or unavailable - the plan stays on the page only
  }
};
