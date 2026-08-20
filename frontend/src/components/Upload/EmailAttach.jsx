import React, { useEffect, useRef, useState } from "react";
import { Mail, UploadCloud, X, Loader2 } from "lucide-react";
import { BACKEND_URL } from "../../config";
import "./emailAttach.css";

const ACCEPT = ".eml,.msg";

// Storage-only companion to UploadFile — never touches /api/extract or the
// Gemini pipeline. Only enabled once a technical file has been uploaded and
// extracted (documentId exists), since an email can only be linked to an
// already-created document row (see backend/services/emails_repo.py).
const EmailAttach = ({ documentId, onLinked }) => {
  const inputRef = useRef(null);
  const [email, setEmail] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // A new technical-file upload means a new document — any previously
  // attached email belonged to the old one, so the local pill resets.
  useEffect(() => {
    setEmail(null);
    setError("");
  }, [documentId]);

  const openFilePicker = () => inputRef.current?.click();

  const handleFile = async (file) => {
    if (!file || !documentId) return;

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("email", file);
    formData.append("document_id", String(documentId));

    try {
      const response = await fetch(`${BACKEND_URL}/api/emails/upload`, { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Could not attach this email (${response.status}).`);
      }

      setEmail(data);
      onLinked?.();
    } catch (err) {
      const isNetworkError = err instanceof TypeError;
      setError(isNetworkError ? "Could not reach the backend. Is it running?" : err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!email) return;
    try {
      await fetch(`${BACKEND_URL}/api/emails/${email.id}`, { method: "DELETE" });
    } catch {
      // Best-effort — the pill clears locally regardless so the user can
      // retry attaching either way.
    }
    setEmail(null);
    onLinked?.();
  };

  return (
    <div className="email-attach-card">
      <div className="email-attach-header">
        <span className="email-attach-icon">
          <Mail size={15} />
        </span>
        <div>
          <div className="email-attach-title">Attach Email (optional)</div>
          <div className="email-attach-subtitle">
            Stored for reference and linked to the drawing above — never sent to AI.
          </div>
        </div>
      </div>

      {!documentId ? (
        <div className="email-attach-hint">Upload a technical file first to attach its related email.</div>
      ) : email ? (
        <div className="email-attach-pill">
          <Mail size={13} />
          <span className="email-attach-pill-text" title={email.subject || email.fileName}>
            {email.subject || email.fileName}
          </span>
          <button type="button" className="email-attach-remove" onClick={handleRemove} aria-label="Remove attached email">
            <X size={13} />
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept={ACCEPT}
            onChange={(e) => {
              const file = e.target.files?.[0];
              handleFile(file);
              e.target.value = "";
            }}
          />
          <button type="button" className="email-attach-browse" onClick={openFilePicker} disabled={uploading}>
            {uploading ? <Loader2 size={14} className="email-attach-spinner" /> : <UploadCloud size={14} />}
            {uploading ? "Uploading…" : "Choose .eml or .msg file"}
          </button>
        </>
      )}

      {error && <div className="email-attach-error">{error}</div>}
    </div>
  );
};

export default EmailAttach;
