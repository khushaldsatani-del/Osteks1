import { BACKEND_URL } from "../../config";

// Thin wrapper around the /api/production routes (backend/main.py,
// services/production_repo.py) - same "fetch, throw on failure, let the
// caller decide" shape as eightDReportsApi.js. Errors carry the backend's
// own message when it sent one.

const json = async (response, message) => {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || message);
  }
  return response.json();
};

// Step 1 of an import: parse the workbook and compare it with what is
// stored. Nothing is written until commitImport().
export async function previewImport(file) {
  const form = new FormData();
  form.append("file", file);
  return json(await fetch(`${BACKEND_URL}/api/production/import`, { method: "POST", body: form }), "Upload failed.");
}

// The newest upload that was previewed but never saved (or null).
export async function getPendingImport() {
  const body = await json(await fetch(`${BACKEND_URL}/api/production/import/pending`), "Could not load the pending upload.");
  return body.upload;
}

export async function commitImport(id) {
  const saved = await json(
    await fetch(`${BACKEND_URL}/api/production/import/${id}/commit`, { method: "POST" }),
    "Could not save the data.",
  );
  forgetBacklog();
  return saved;
}

export async function discardImport(id) {
  return json(await fetch(`${BACKEND_URL}/api/production/import/${id}`, { method: "DELETE" }), "Could not discard.");
}

export async function listUploads() {
  return json(await fetch(`${BACKEND_URL}/api/production/uploads`), "Could not load the upload history.");
}

export async function listMetrics() {
  return json(await fetch(`${BACKEND_URL}/api/production/metrics`), "Could not load the stored data.");
}

// Daily backlog for the whole stored range: { firstDate, lastDate, days:
// [{ date, ktl, pulver, schaeumen, carryForward }] }. The dashboard groups
// it into weeks/months itself (backlogMath.js), so switching period or
// range never needs another request.
export async function getBacklog() {
  const data = await json(await fetch(`${BACKEND_URL}/api/production/backlog`), "Could not load the backlog data.");
  rememberBacklog(data);
  return data;
}

// The last backlog series seen, so the dashboard can show it instantly on
// the next visit (or page reload) while getBacklog() refreshes it in the
// background. Kept in memory and in localStorage; storage may be
// unavailable, which only costs the instant first paint.
const BACKLOG_STORAGE_KEY = "productionView.backlog";
let backlogMemory = null;

function rememberBacklog(data) {
  backlogMemory = data;
  try {
    localStorage.setItem(BACKLOG_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // private mode / quota - keep the in-memory copy only
  }
}

export function cachedBacklog() {
  if (backlogMemory) return backlogMemory;
  try {
    const stored = localStorage.getItem(BACKLOG_STORAGE_KEY);
    if (stored) backlogMemory = JSON.parse(stored);
  } catch {
    backlogMemory = null;
  }
  return backlogMemory;
}

// After an upload is saved the stored copy is stale - drop it so the
// dashboard's next visit waits for the fresh series instead.
export function forgetBacklog() {
  backlogMemory = null;
  try {
    localStorage.removeItem(BACKLOG_STORAGE_KEY);
  } catch {
    // nothing stored
  }
}
