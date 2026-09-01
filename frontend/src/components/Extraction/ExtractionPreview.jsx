import React from "react";
import { FileSearch, AlertTriangle } from "lucide-react";
import { useTranslation } from "../../i18n/LanguageContext";
import ExtractionSteps from "./ExtractionSteps";
import "./extraction.css";

// Temporary section: shows the AI-extracted summary of the most recently
// uploaded drawing, directly below Upload File / Uploaded Files. Purely a
// preview of backend/server.js's POST /api/extract response — nothing here
// is wired into the calculation state yet.
const ExtractionPreview = ({
  status = "idle",
  fileName = "",
  summary = "",
  error = "",
  stepStartedAt = null,
  hydrating = false,
}) => {
  const { t } = useTranslation();
  return (
    <div className="extraction-card">
      <div className="extraction-card-header">
        <span className="extraction-card-icon">
          <FileSearch size={16} />
        </span>
        <h3 className="extraction-card-title">{t("extraction.title")}</h3>
        {!hydrating && fileName && status !== "idle" && <span className="extraction-file-name">{fileName}</span>}
      </div>

      <div className="extraction-body">
        {/* "Open in Workspace" fetching a saved record's data — takes
            priority over `status` (which still reflects whatever this
            slot's own prior extraction state was, stale until the fetch
            resolves) so this card alone shows loading, not the rest of
            the page. */}
        {hydrating ? (
          <div className="extraction-placeholder extraction-hydrating">
            <span className="extraction-hydrating-spinner" />
            {t("extraction.loadingRecord")}
          </div>
        ) : (
          <>
            {status === "idle" && (
              <div className="extraction-placeholder">{t("extraction.idlePlaceholder")}</div>
            )}

            {status === "loading" && (
              <div className="extraction-placeholder extraction-loading">
                <ExtractionSteps stepStartedAt={stepStartedAt} />
              </div>
            )}

            {status === "error" && (
              <div className="extraction-placeholder extraction-error">
                <AlertTriangle size={16} />
                {error || t("extraction.errorFallback")}
              </div>
            )}

            {status === "success" && <pre className="extraction-text">{summary}</pre>}
          </>
        )}
      </div>
    </div>
  );
};

export default ExtractionPreview;
