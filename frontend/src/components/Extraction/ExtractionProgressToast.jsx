import React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "../../i18n/LanguageContext";
import "./extractionProgressToast.css";

// Fixed bottom-right progress card for a drawing extraction. Purely
// presentational — UploadFile.jsx owns the progress model (see
// extractionProgress.js) and feeds this the current numbers. While running
// it never displays 100: the model itself is capped below 100 until the
// extracted details have actually been applied.
const ExtractionProgressToast = ({ toast }) => {
  const { t } = useTranslation();
  if (!toast) return null;

  const { state, percent, fileIndex, fileCount, fileName, stage, errorMessage, indeterminate } = toast;
  const rounded = state === "done" ? 100 : Math.min(99, Math.floor(percent));
  const showPercent = state !== "error" && !(indeterminate && state === "running");

  const stageLabel = t(`extractionProgress.${stage}`);

  // Portaled onto <body> so no ancestor's transform/overflow can ever
  // displace or clip a position: fixed card.
  return createPortal(
    <div className={`xprogress xprogress--${state}`} role="status" aria-live="polite">
      <div className="xprogress-head">
        <span className="xprogress-icon">
          {state === "done" ? <CheckCircle2 size={16} /> : state === "error" ? <AlertCircle size={16} /> : <Loader2 size={16} className="xprogress-spin" />}
        </span>
        <div className="xprogress-titles">
          <div className="xprogress-title">
            {state === "error" ? t("extractionProgress.failed") : state === "done" ? t("extractionProgress.done") : stageLabel}
          </div>
          <div className="xprogress-sub">
            {fileCount > 1 ? `${t("extractionProgress.fileOf", { current: fileIndex + 1, total: fileCount })} · ` : ""}
            {state === "error" ? errorMessage : fileName}
          </div>
        </div>
        {showPercent && <div className="xprogress-percent">{rounded}%</div>}
      </div>
      {state !== "error" && (
        <div className="xprogress-track" aria-hidden="true">
          {indeterminate && state === "running" ? (
            <div className="xprogress-fill xprogress-fill--indeterminate" />
          ) : (
            <div className="xprogress-fill" style={{ width: `${rounded}%` }} />
          )}
        </div>
      )}
    </div>,
    document.body
  );
};

export default ExtractionProgressToast;
