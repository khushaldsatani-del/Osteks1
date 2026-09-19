import { BACKEND_URL } from "../../config";

// The browser could not reach the backend at all (as opposed to the backend
// answering with an error) — kept distinct so the caller can show the
// dedicated "backend unreachable" message, same as the old fetch-based
// version's TypeError check did.
export class ExtractionNetworkError extends Error {}

// The backend answered 404 for the streaming endpoint itself — i.e. it's an
// older deployment that only has the original blocking endpoints (the
// frontend and backend deploy separately, so the frontend can briefly be
// newer than the backend). Caught below to fall back instead of failing.
class StreamEndpointMissingError extends Error {}

// POSTs a form to one of the backend's streaming extraction endpoints (see
// backend/main.py's _ndjson_stream) and resolves with the final "result"
// event, while forwarding every real progress event the server streams back
// to `onEvent`, and the browser's own exact upload byte count to
// `onUploadProgress`. XMLHttpRequest instead of fetch because fetch cannot
// report upload progress at all.
const streamRequest = (path, formData, { onEvent, onUploadProgress } = {}) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BACKEND_URL}${path}`);

    let consumed = 0;
    let result = null;
    let streamError = null;

    const handleLine = (line) => {
      if (!line.trim()) return;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (event.type === "result") result = event;
      if (event.type === "error") streamError = event.error;
      onEvent?.(event);
    };

    // Only complete lines are parsed — a chunk boundary can land mid-line,
    // so the unfinished tail stays unconsumed until its newline arrives.
    const drain = () => {
      const pending = xhr.responseText.slice(consumed);
      const lastNewline = pending.lastIndexOf("\n");
      if (lastNewline < 0) return;
      pending
        .slice(0, lastNewline + 1)
        .split("\n")
        .forEach(handleLine);
      consumed += lastNewline + 1;
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onUploadProgress?.(event.loaded, event.total);
    };

    xhr.onprogress = () => {
      if (xhr.status === 200) drain();
    };

    xhr.onload = () => {
      if (xhr.status === 404) {
        reject(new StreamEndpointMissingError(`${path} not found`));
        return;
      }
      if (xhr.status !== 200) {
        let message = null;
        try {
          message = JSON.parse(xhr.responseText).error;
        } catch {
          // Non-JSON error body — falls through to the status-based message.
        }
        reject(new Error(message || `Extraction failed (${xhr.status}).`));
        return;
      }
      drain();
      handleLine(xhr.responseText.slice(consumed));
      if (streamError) reject(new Error(streamError));
      else if (result) resolve(result);
      else reject(new Error("The extraction connection closed before a result arrived."));
    };

    xhr.onerror = () => reject(new ExtractionNetworkError("Backend unreachable."));

    xhr.send(formData);
  });

// The original blocking endpoint — one request, one answer, no progress
// events (so `onEvent` is told, once, that live progress isn't available).
const legacyRequest = async (path, formData, { onEvent } = {}) => {
  onEvent?.({ type: "legacy" });
  let response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, { method: "POST", body: formData });
  } catch {
    throw new ExtractionNetworkError("Backend unreachable.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Extraction failed (${response.status}).`);
  return data;
};

// One drawing -> { summary, meta } (the same shape /api/extract returns).
export const streamExtract = async (file, options) => {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const result = await streamRequest("/api/extract-stream", formData, options);
    return { summary: result.summary, meta: result.meta };
  } catch (error) {
    if (!(error instanceof StreamEndpointMissingError)) throw error;
    const data = await legacyRequest("/api/extract", formData, options);
    return { summary: data.summary, meta: data.meta };
  }
};

// One email -> { parts } (the same shape /api/extract-email returns).
export const streamExtractEmail = async (file, maxParts, options) => {
  const formData = new FormData();
  formData.append("email", file);
  formData.append("max_parts", String(maxParts));
  try {
    const result = await streamRequest("/api/extract-email-stream", formData, options);
    return { parts: Array.isArray(result.parts) ? result.parts : [] };
  } catch (error) {
    if (!(error instanceof StreamEndpointMissingError)) throw error;
    const data = await legacyRequest("/api/extract-email", formData, options);
    return { parts: Array.isArray(data.parts) ? data.parts : [] };
  }
};
