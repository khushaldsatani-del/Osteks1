// Fetches the condensed Standards-KB lookup for a detected norm/spec text
// (e.g. "VW 13750 - Ofl-x633 TL227") from the read-only /api/kb/lookup
// route — see backend/services/kb_repo.py's lookup_specification. Used by
// Documents.jsx right after an image/email extraction succeeds (covers a
// single image, every image in a multi-image offer, and every part of an
// email extraction alike, since they all funnel through the same
// handleExtractionResult) to power the All Documents "Specification"
// column and the Schichtdicke auto-fill fallback.
//
// Best-effort only: a network failure or "no match" both resolve to null,
// never throwing — this must never interrupt or fail the extraction flow
// it's attached to.
import { BACKEND_URL } from "../../config";

export async function fetchKbSpecification(normText) {
  if (!normText || typeof normText !== "string") return null;
  const trimmed = normText.trim();
  if (!trimmed || trimmed === "—") return null;

  try {
    const response = await fetch(`${BACKEND_URL}/api/kb/lookup?q=${encodeURIComponent(trimmed)}`);
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    if (!data || !data.matched) return null;
    return data;
  } catch {
    return null;
  }
}
