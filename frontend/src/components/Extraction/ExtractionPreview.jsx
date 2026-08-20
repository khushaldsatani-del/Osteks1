import React from "react";
import { FileSearch, Loader2, AlertTriangle } from "lucide-react";
import "./extraction.css";

// Temporary section: shows the AI-extracted summary of the most recently
// uploaded drawing, directly below Upload File / Uploaded Files. Purely a
// preview of backend/server.js's POST /api/extract response — nothing here
// is wired into the calculation state yet.
const ExtractionPreview = ({ status = "idle", fileName = "", summary = "", error = "" }) => {
  return (
    <div className="extraction-card">
      <div className="extraction-card-header">
        <span className="extraction-card-icon">
          <FileSearch size={16} />
        </span>
        <h3 className="extraction-card-title">Extracted Drawing Details</h3>
        {fileName && status !== "idle" && <span className="extraction-file-name">{fileName}</span>}
      </div>

      <div className="extraction-body">
        {status === "idle" && (
          <div className="extraction-placeholder">
            Upload a drawing above to see the extracted part, material, thickness, weight and coating details here.
          </div>
        )}

        {status === "loading" && (
          <div className="extraction-placeholder extraction-loading">
            <Loader2 size={16} className="extraction-spinner" />
            Analyzing drawing — reading title block, BOM and notes…
          </div>
        )}

        {status === "error" && (
          <div className="extraction-placeholder extraction-error">
            <AlertTriangle size={16} />
            {error || "Could not extract information from this drawing."}
          </div>
        )}

        {status === "success" && <pre className="extraction-text">{summary}</pre>}
      </div>
    </div>
  );
};

export default ExtractionPreview;
