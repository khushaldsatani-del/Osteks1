import React, { useRef, useState } from "react";
import { UploadCloud, Image as ImageIcon, CircleHelp, Mail, X } from "lucide-react";
import { BACKEND_URL } from "../../config";
import { useTranslation } from "../../i18n/LanguageContext";
import UploadInfoModal from "./UploadInfoModal";
import "./upload.css";

const COMBINED_ACCEPT = ".pdf,.png,.jpg,.jpeg,.tif,.tiff,.eml,.msg";
const DRAWING_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "tif", "tiff"];
const EMAIL_EXTENSIONS = ["eml", "msg"];

function extensionOf(file) {
  return file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One drop zone for both the drawing(s) and the related email — files are
// sorted by extension, not by which slot they landed in. Up to 4 drawings
// can be picked/dropped in one go (`maxFiles`, from Documents.jsx's
// remaining slot capacity) — they're still sent to the AI one at a time, in
// order, exactly like a single upload always was (see processDrawingFiles
// below), so extraction accuracy/behavior per image is unchanged; only the
// trigger (pick many at once vs. one at a time) is different. Each file's
// start/result/error is reported with its index within this batch
// (0, 1, 2…) via onExtractionStart/onExtractionResult/onExtractionError,
// and onBatchStart(count) fires once up front so Documents.jsx can create
// the right number of image slots before the first result comes back. The
// email is purely staged here (emailFile/onEmailFileChange are controlled
// by Documents.jsx) and only actually uploaded once the first (parent)
// drawing's extraction succeeds — see Documents.jsx's handleExtractionResult
// for that orchestration and the business rule it enforces: no successful
// extraction, no stored email, ever.
const UploadFile = ({
  onExtractionStart,
  onExtractionResult,
  onExtractionError,
  onBatchStart,
  maxFiles = 3,
  hasImageSource = false,
  emailFile,
  onEmailFileChange,
  emailStatus = "idle",
  emailError = "",
} = {}) => {
  const { t } = useTranslation();
  const EMAIL_STATUS_LABEL = {
    linking: t("upload.emailLinking"),
    linked: t("upload.emailAttached"),
    error: t("upload.emailNotAttached"),
  };
  const inputRef = useRef(null);

  // Tracks the currently-processing (or just-finished) file in this drop
  // zone's own preview — independent of which image slot/tab is active, so
  // this component no longer needs to remount per slot to stay correct.
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [dragging, setDragging] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Files picked/dropped but not yet confirmed — nothing here has been sent
  // to the AI yet. mode "drawings" holds one or more drawings (email, if any
  // came along, is already staged via onEmailFileChange since attaching it
  // is not itself an AI call); mode "emailOnly" holds a single email that
  // would become the calculation source. Replaced wholesale by picking/
  // dropping again before confirming, cleared entirely on Confirm or Cancel.
  const [pending, setPending] = useState(null);

  const extractDrawing = async (selectedFile, index) => {
    setStatus("loading");
    onExtractionStart?.(selectedFile.name, index);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${BACKEND_URL}/api/extract`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || t("upload.errorExtractionFailed", { status: response.status }));
      }

      setStatus("success");
      onExtractionResult?.(data.summary, data.meta, index);
    } catch (error) {
      const isNetworkError = error instanceof TypeError;
      const message = isNetworkError ? t("upload.errorBackendUnreachable") : error.message;
      setStatus("error");
      onExtractionError?.(message, index);
    }
  };

  // Drawings are extracted strictly one at a time, in order — the same
  // proven single-image pipeline just run in sequence, never in parallel,
  // so a drawing's accuracy never depends on how many others were picked
  // alongside it.
  const processDrawingFiles = async (drawings) => {
    onBatchStart?.(drawings.length);
    for (let index = 0; index < drawings.length; index += 1) {
      setFile(drawings[index]);
      // eslint-disable-next-line no-await-in-loop
      await extractDrawing(drawings[index], index);
    }
  };

  // Email-only calculation source (no drawing uploaded for this offer) —
  // reuses the exact same onBatchStart/onExtractionStart/onExtractionResult
  // contract Documents.jsx already wired up for images, so its slot
  // assignment logic needs zero changes to also work here.
  //
  // Unlike drawings, the true part count isn't known until the single
  // backend call actually returns (the email may describe 1-4 distinct
  // components) — but that call itself can take a while (a full two-stage
  // AI pass over the email + every embedded image), and during that wait
  // the images path already shows its per-tab loading/ExtractionSteps
  // animation for real. Claiming slot 1 with a provisional count of 1
  // *before* the fetch starts gives the email path that exact same live
  // feedback instead of a blank drop zone until everything resolves at
  // once. If the response turns out to describe more than one part,
  // onBatchStart is called again with the real count and
  // { reuseActiveSlot: true } so slot 1 keeps its place as part 0 instead
  // of being abandoned — see handleBatchStart's own comment in
  // Documents.jsx for why that option exists.
  const processEmailOnlyFile = async (selectedEmail) => {
    setFile(selectedEmail);
    setStatus("loading");

    onBatchStart?.(1, { reuseActiveSlot: true });
    onExtractionStart?.(selectedEmail.name, 0);

    const formData = new FormData();
    formData.append("email", selectedEmail);
    formData.append("max_parts", String(Math.max(1, maxFiles)));

    try {
      const response = await fetch(`${BACKEND_URL}/api/extract-email`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || t("upload.errorExtractionFailed", { status: response.status }));
      }

      const parts = Array.isArray(data.parts) ? data.parts : [];
      if (parts.length === 0) {
        throw new Error(t("upload.errorNoEmailCalculationData"));
      }

      if (parts.length > 1) {
        onBatchStart?.(parts.length, { reuseActiveSlot: true });
      }
      for (let index = 0; index < parts.length; index += 1) {
        if (index > 0) {
          onExtractionStart?.(parts[index].meta?.fileName || selectedEmail.name, index);
          // eslint-disable-next-line no-await-in-loop
          await sleep(500);
        }
        // Documents.jsx's onExtractionResult creates that slot's document
        // row and, for slot 2+, links it to slot 1 via parentDocumentId —
        // read from a ref that's only updated once slot 1's own document
        // creation has actually completed. Awaiting each call here
        // (matching how the image path's processDrawingFiles awaits
        // extractDrawing) guarantees that ref is populated before the
        // NEXT part starts — without it, a multi-part email's later slots
        // can race ahead of an earlier slot's still-in-flight document
        // creation and get persisted as orphaned top-level documents
        // instead of proper child slots of the same offer (confirmed: a
        // real 4-part upload left slot 2 with no parentDocumentId at all).
        // eslint-disable-next-line no-await-in-loop
        await onExtractionResult?.(parts[index].summary, parts[index].meta, index);
      }

      setStatus("success");
    } catch (error) {
      const isNetworkError = error instanceof TypeError;
      const message = isNetworkError ? t("upload.errorBackendUnreachable") : error.message;
      setStatus("error");
      onExtractionError?.(message, 0);
    }
  };

  // One shared entry point for both drag-drop and the file picker — sorts
  // whatever came in (drawing(s), optionally with an email, picked/dropped
  // together) by extension. Unrecognized files are reported as an error
  // only when nothing usable was found at all, so an email-only drop
  // (staging ahead of the drawing) never looks like a failure. Drawings
  // beyond `maxFiles` are silently dropped — Documents.jsx already has no
  // room left for them (at most 4 images per offer).
  //
  // An email dropped with no drawing in the same action would trigger
  // calculation extraction from the email itself — but only when no image
  // already exists for this offer (hasImageSource): once any drawing has
  // been uploaded, images are the only calculation source and email stays
  // reference/storage-only, even if it's added in a separate, later drop.
  //
  // Nothing here calls the AI — or stages the email — until Confirm. A
  // pick/drop only fills `pending` for review; confirmPending() below is
  // the only path that starts processDrawingFiles/processEmailOnlyFile
  // AND the only path that calls onEmailFileChange for an email riding
  // along with drawings. Deferring the email this way (rather than
  // staging it immediately on drop, as this used to do) is what makes
  // Cancel actually cancel the whole batch — previously the email had
  // already been pushed up to Documents.jsx before Cancel ever ran, so it
  // stayed behind even after the drawings were cleared. The one exception
  // is an email dropped alongside an already-existing image source (last
  // branch): attaching it is pure storage, never an AI call, so there is
  // nothing to confirm there and it stages immediately as before.
  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const drawings = files.filter((f) => DRAWING_EXTENSIONS.includes(extensionOf(f))).slice(0, Math.max(1, maxFiles));
    const email = files.find((f) => EMAIL_EXTENSIONS.includes(extensionOf(f)));

    if (drawings.length > 0) {
      setPending({ mode: "drawings", drawings, email: email || null });
    } else if (email && !hasImageSource) {
      setPending({ mode: "emailOnly", drawings: [], email });
    } else if (email) {
      onEmailFileChange?.(email);
    } else {
      onExtractionError?.(t("upload.errorUnsupportedFile"), 0);
    }
  };

  const confirmPending = () => {
    if (!pending) return;
    const { mode, drawings, email } = pending;
    setPending(null);
    if (mode === "drawings") {
      if (email) onEmailFileChange?.(email);
      processDrawingFiles(drawings);
    } else if (mode === "emailOnly") {
      processEmailOnlyFile(email);
    }
  };

  // Nothing was staged anywhere outside this component yet (see above), so
  // clearing `pending` alone is enough to make Cancel drop everything —
  // drawings and email alike.
  const cancelPending = () => setPending(null);

  // Once there's anything to show below it (pending confirmation, an
  // in-progress/finished drawing, or a staged email), the big drop-zone
  // prompt collapses to a slim bar — freeing up the room that content
  // needs so the whole card can still fit within the height the Uploaded
  // Files table already stretches it to (see upload.css), rather than the
  // card growing taller than the table every time there's more to show.
  const isCompactDropZone = Boolean(pending || file || emailFile);

  const handleInputChange = (event) => {
    handleFiles(event.target.files);
    // Allows selecting the same file(s) again
    event.target.value = "";
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 KB";

    const mb = bytes / (1024 * 1024);

    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    }

    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div className="upload-file-card">

      {/* How-upload-works trigger — fixed top-right of the card */}
      <button
        type="button"
        className="upload-info-trigger"
        onClick={() => setInfoOpen(true)}
        aria-label={t("upload.howUploadWorks")}
        title={t("upload.howUploadWorks")}
      >
        <CircleHelp size={18} />
      </button>

      {/* Section Label */}
      <div className="upload-file-title">
        <span className="upload-title-icon">
          <UploadCloud size={16} />
        </span>
        {t("upload.title")}
      </div>

      {/* Hidden File Input — accepts the drawing and/or the email together,
          sorted by extension in handleFiles(). */}
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept={COMBINED_ACCEPT}
        onChange={handleInputChange}
      />

      {/* Everything below the title lives in one scrollable area with a
          bounded height (see upload.css) — so no matter how much is
          stacked here (a compact drop zone + a 3-file confirm panel + a
          staged email, say), the card itself never grows past the height
          Uploaded Files' table already stretches it to; it scrolls
          internally instead once content genuinely doesn't fit. */}
      <div className="upload-file-scroll-area">
        {/* DROP AREA — collapses to a slim bar once there's a pending
            selection, an active/finished drawing, or a staged email to
            show below it (see isCompactDropZone); still a full drop
            target either way. */}
        <div
          className={`upload-drop-zone ${dragging ? "dragging" : ""} ${isCompactDropZone ? "upload-drop-zone--compact" : ""}`}
          onClick={openFilePicker}
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragging(false);
          }}
          onDrop={handleDrop}
        >
          {isCompactDropZone ? (
            <button
              type="button"
              className="upload-add-more-btn"
              onClick={(event) => {
                event.stopPropagation();
                openFilePicker();
              }}
            >
              <UploadCloud size={14} />
              {t("upload.addMoreFiles")}
            </button>
          ) : (
            <>
              {/* Cloud Upload Icon */}
              <div className="upload-cloud-icon">
                <svg
                  width="38"
                  height="38"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9" />

                  <path d="M16 16l3-3 3 3" />

                  <path d="M19 13v7" />
                </svg>
              </div>

              <div className="upload-title">{t("upload.dropTitle")}</div>

              <div className="upload-description">
                {t("upload.dropDescLine1")}
                <br />
                {t("upload.dropDescLine2")}
              </div>

              {/* Browse Button */}
              <button
                type="button"
                className="browse-button"
                onClick={(event) => {
                  event.stopPropagation();
                  openFilePicker();
                }}
              >
                {t("upload.browseFiles")}
              </button>
            </>
          )}
        </div>

        {/* PENDING CONFIRMATION — shown after a pick/drop, before anything is
            sent to the AI. Replaced by the normal processing preview below
            the moment confirmPending() runs. */}
        {pending && (
        <div className="upload-confirm-panel">
          <div className="upload-confirm-title">
            {t("upload.confirmTitle", {
              count:
                pending.mode === "drawings" ? pending.drawings.length + (pending.email ? 1 : 0) : 1,
            })}
          </div>

          <ul className="upload-confirm-file-list">
            {(pending.mode === "drawings" ? pending.drawings : []).map((f, index) => (
              <li className="upload-confirm-file-row" key={`${f.name}-${index}`}>
                <ImageIcon size={14} color="#14b8a6" />
                <span className="upload-confirm-file-name" title={f.name}>
                  {f.name}
                </span>
                <span className="upload-confirm-file-size">{formatFileSize(f.size)}</span>
              </li>
            ))}
            {/* The email (drawings mode: riding along; emailOnly mode: the
                calculation source itself) is listed here too — so
                everything this Confirm click will act on is visible
                up front, not just the drawings. */}
            {(pending.mode === "drawings" && pending.email ? [pending.email] : pending.mode === "emailOnly" ? [pending.email] : []).map(
              (f) => (
                <li className="upload-confirm-file-row" key={f.name}>
                  <Mail size={14} color="#14b8a6" />
                  <span className="upload-confirm-file-name" title={f.name}>
                    {f.name}
                  </span>
                  <span className="upload-confirm-file-size">{formatFileSize(f.size)}</span>
                </li>
              )
            )}
          </ul>
        </div>
        )}

        {/* Confirm/Cancel — deliberately outside .upload-confirm-panel (a
            sibling below it, not a child inside its box), per request. */}
        {pending && (
          <div className="upload-confirm-actions">
            <button type="button" className="upload-confirm-cancel" onClick={cancelPending}>
              {t("common.cancel")}
            </button>
            <button type="button" className="upload-confirm-btn" onClick={confirmPending}>
              {t("upload.confirmAndProcess")}
            </button>
          </div>
        )}

      {/* SELECTED DRAWING */}
      {file && (
        <div className="upload-file-preview">

          {/* File Icon */}
          <div className="pdf-icon">
            <ImageIcon size={20} color="#14b8a6" />
          </div>

          {/* File Information */}
          <div className="uploaded-file-info">
            <div className="uploaded-file-name">
              {file.name}
            </div>

            <div className="uploaded-file-meta">
              {formatFileSize(file.size)}

              <span>•</span>

              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          {/* Status — spins while the drawing extraction is still running,
              switches to the checkmark only once it actually succeeds. */}
          {status === "success" ? (
            <div className="uploaded-status">
              <span className="status-check">
                ✓
              </span>

              {t("upload.statusUploaded")}
            </div>
          ) : status === "error" ? (
            <div className="uploaded-status uploaded-status--error">
              <span className="status-check status-check--error">
                !
              </span>

              {t("upload.statusFailed")}
            </div>
          ) : (
            <div className="uploaded-status uploaded-status--pending">
              <span className="status-spinner" />
              {t("upload.statusUploading")}
            </div>
          )}
        </div>
      )}

      {/* SELECTED EMAIL — only appears once one has been dropped/picked
          alongside (or separately from) the drawing above; nothing to show
          when none was included, since it's optional. */}
      {emailFile && (
        <div className="upload-email-section">
          <div className={`upload-email-pill upload-email-pill--${emailStatus}`}>
            <Mail size={12} />
            <span className="upload-email-pill-text" title={emailFile.name}>
              {emailFile.name}
            </span>
            {emailStatus !== "idle" && (
              <span className="upload-email-pill-status">{EMAIL_STATUS_LABEL[emailStatus] || ""}</span>
            )}
            {emailStatus !== "linking" && (
              <button
                type="button"
                className="upload-email-remove"
                onClick={() => onEmailFileChange?.(null)}
                aria-label={t("upload.removeSelectedEmail")}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {emailStatus === "error" && emailError && <div className="upload-email-error">{emailError}</div>}
        </div>
      )}
      </div>

      {infoOpen && <UploadInfoModal onClose={() => setInfoOpen(false)} />}
    </div>
  );
};

export default UploadFile;
