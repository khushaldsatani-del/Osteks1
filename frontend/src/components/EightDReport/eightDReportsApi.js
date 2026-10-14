import { BACKEND_URL } from "../../config";

// Thin wrapper around the /api/eightd-reports routes (backend/main.py,
// services/eightd_reports_repo.py) - same "fetch, throw on failure, let the
// caller decide" shape as testReportsApi.js.

const json = (response, message) => {
  if (!response.ok) throw new Error(message);
  return response.json();
};

const send = (url, method, body) =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function listEightDReports() {
  return json(await fetch(`${BACKEND_URL}/api/eightd-reports`), "Could not load 8D reports.");
}

export async function getEightDReport(id) {
  return json(await fetch(`${BACKEND_URL}/api/eightd-reports/${id}`), "Could not load this 8D report.");
}

export async function createEightDReport(body) {
  return json(await send(`${BACKEND_URL}/api/eightd-reports`, "POST", body), "Could not save the 8D report.");
}

export async function updateEightDReport(id, body) {
  return json(await send(`${BACKEND_URL}/api/eightd-reports/${id}`, "PATCH", body), "Could not save the 8D report.");
}

export async function deleteEightDReport(id) {
  return json(
    await fetch(`${BACKEND_URL}/api/eightd-reports/${id}`, { method: "DELETE" }),
    "Could not delete the 8D report."
  );
}
