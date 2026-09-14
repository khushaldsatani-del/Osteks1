import { BACKEND_URL } from "../../config";

// Thin wrapper around the /api/test-reports routes (see backend/main.py /
// README.md) — same "fetch, throw on failure, let the caller decide what
// that means" shape as Documents.jsx's own inline fetch calls, not a full
// client library.

export async function listTestReports() {
  const response = await fetch(`${BACKEND_URL}/api/test-reports`);
  if (!response.ok) throw new Error("Could not load test reports.");
  return response.json();
}

export async function getTestReport(id) {
  const response = await fetch(`${BACKEND_URL}/api/test-reports/${id}`);
  if (!response.ok) throw new Error("Could not load this test report.");
  return response.json();
}

// Backs Document Preview's "Test erforderlich" checkbox reflecting reality
// when a document is reopened — null (not an error) when no report is
// linked to this document yet, same as the backend route's own contract.
export async function getTestReportByDocumentId(documentId) {
  const response = await fetch(`${BACKEND_URL}/api/test-reports/by-document/${documentId}`);
  if (!response.ok) throw new Error("Could not check for an existing test report.");
  return response.json();
}

export async function createTestReport(body) {
  const response = await fetch(`${BACKEND_URL}/api/test-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Could not create the test report.");
  return response.json();
}

export async function updateTestReport(id, body) {
  const response = await fetch(`${BACKEND_URL}/api/test-reports/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Could not save the test report.");
  return response.json();
}

export async function deleteTestReport(id) {
  const response = await fetch(`${BACKEND_URL}/api/test-reports/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Could not delete the test report.");
  return response.json();
}

// `objectPath` values contain real "/" characters (e.g. "test-reports/7/
// cycle5.before-abc123.png") and are passed through as-is, never
// URL-encoded — the backend route uses FastAPI's `{object_path:path}`
// converter, which is designed to capture a raw multi-segment path exactly
// like this.
export async function uploadTestReportImage(reportId, slot, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("slot", slot);
  const response = await fetch(`${BACKEND_URL}/api/test-reports/${reportId}/images`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Could not upload this image.");
  return response.json();
}

// The backend streams the image's bytes back directly (proxied through
// Cloud Storage, never a signed URL — see gcs_storage.py) — this URL is
// usable as a plain <img src> with no separate fetch needed.
export function testReportImageUrl(reportId, objectPath) {
  return `${BACKEND_URL}/api/test-reports/${reportId}/images/${objectPath}/url`;
}

export async function deleteTestReportImage(reportId, objectPath) {
  const response = await fetch(`${BACKEND_URL}/api/test-reports/${reportId}/images/${objectPath}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Could not delete this image.");
  return response.json();
}

// Every image-holding piece of wizard state (cyclesData/crosscutData/
// constantClimateData/figures/...) stores this exact shape once uploaded —
// `url` is the backend's own proxy endpoint, directly usable as an
// <img src> with no local blob: URL involved anywhere.
export async function uploadReportImage(reportId, slot, file) {
  const result = await uploadTestReportImage(reportId, slot, file);
  return {
    objectPath: result.objectPath,
    name: result.originalFilename || file.name,
    url: testReportImageUrl(reportId, result.objectPath),
  };
}

// Best-effort — losing track of an orphaned GCS object (network hiccup,
// the report having just been deleted out from under this call, ...) is a
// minor storage cost, never worth surfacing as an error or blocking
// whatever UI action (a replace or remove) triggered it.
export async function deleteReportImageBestEffort(reportId, image) {
  if (!image?.objectPath || !reportId) return;
  try {
    await deleteTestReportImage(reportId, image.objectPath);
  } catch {
    // ignore
  }
}
