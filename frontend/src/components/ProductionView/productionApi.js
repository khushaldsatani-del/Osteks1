import { BACKEND_URL } from "../../config";

// Thin wrapper around the /api/production routes (backend/main.py,
// services/production_repo.py). Every failure throws an ImportError with a
// `code` the pages translate into a message:
//   - the server's own code when it answered ("invalid_file",
//     "not_auswertungen", "already_processed", "save_failed", ...);
//   - "network" when the server couldn't be reached at all;
//   - "timeout" when it didn't answer in time;
//   - "http_<status>" for anything else.
// `detail` keeps the server's English text for the cases without a code.

export class ImportError extends Error {
  constructor(code, detail) {
    super(detail || code);
    this.code = code;
    this.detail = detail;
  }
}

const UPLOAD_TIMEOUT_MS = 120000; // parsing a workbook on a cold server can take a while
const READ_TIMEOUT_MS = 20000;

async function request(path, { method = "GET", body, timeout = READ_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, { method, body, signal: controller.signal });
  } catch (error) {
    throw new ImportError(error.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ImportError(data?.code || `http_${response.status}`, data?.error);
  return data;
}

// Step 1 of an import: parse the workbook and compare it with what is
// stored. Nothing is written until commitImport().
export async function previewImport(file) {
  const form = new FormData();
  form.append("file", file);
  return request("/api/production/import", { method: "POST", body: form, timeout: UPLOAD_TIMEOUT_MS });
}

// The newest upload that was previewed but never saved (or null).
export async function getPendingImport() {
  return (await request("/api/production/import/pending")).upload;
}

export async function commitImport(id) {
  const saved = await request(`/api/production/import/${id}/commit`, { method: "POST", timeout: UPLOAD_TIMEOUT_MS });
  forgetBacklog();
  return saved;
}

export async function discardImport(id) {
  return request(`/api/production/import/${id}`, { method: "DELETE" });
}

export async function listUploads() {
  return request("/api/production/uploads");
}

export async function listMetrics() {
  return request("/api/production/metrics");
}

// Daily backlog for the whole stored range: { firstDate, lastDate, days:
// [{ date, ktl, pulver, schaeumen, carryForward }] }. The dashboard groups
// it into weeks/months itself (backlogMath.js), so switching period or
// range never needs another request.
export async function getBacklog() {
  const data = await request("/api/production/backlog");
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

// The text for an ImportError, in the page's language (keys under
// "productionErrors" in the translations). Unknown codes fall back to the
// server's own text, then to a generic message.
export function importErrorMessage(t, error) {
  const code = error?.code;
  const key = `productionErrors.${code}`;
  const text = code ? t(key) : key;
  if (text !== key) return text;
  return error?.detail || t("productionErrors.generic");
}
