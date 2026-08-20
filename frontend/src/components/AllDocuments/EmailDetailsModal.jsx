import React, { useEffect, useState } from "react";
import { X, Paperclip, Download, Loader2 } from "lucide-react";
import { BACKEND_URL } from "../../config";
import "./emailDetailsModal.css";

function formatSize(bytes) {
  if (!bytes) return "0 KB";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

// Everything shown here is fetched live from the backend/database — never
// hardcoded — matching whatever .eml/.msg the user actually attached.
const EmailDetailsModal = ({ emailId, onClose }) => {
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!emailId) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setEmail(null);

    fetch(`${BACKEND_URL}/api/emails/${emailId}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load this email.");
        if (!cancelled) setEmail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load this email.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [emailId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!emailId) return null;

  return (
    <div className="email-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="email-modal-card">
        <div className="email-modal-header">
          <h3 className="email-modal-title">Email Details</h3>
          <button type="button" className="email-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {loading && (
          <div className="email-modal-state">
            <Loader2 size={18} className="email-modal-spinner" />
            Loading…
          </div>
        )}

        {!loading && error && <div className="email-modal-state email-modal-state--error">{error}</div>}

        {!loading && email && (
          <div className="email-modal-body">
            <div className="email-modal-meta">
              <div className="email-modal-meta-row">
                <span className="email-modal-meta-label">From</span>
                <span className="email-modal-meta-value">{email.from || "—"}</span>
              </div>
              <div className="email-modal-meta-row">
                <span className="email-modal-meta-label">To</span>
                <span className="email-modal-meta-value">{email.to || "—"}</span>
              </div>
              <div className="email-modal-meta-row">
                <span className="email-modal-meta-label">CC</span>
                <span className="email-modal-meta-value">{email.cc || "—"}</span>
              </div>
              <div className="email-modal-meta-row">
                <span className="email-modal-meta-label">Date</span>
                <span className="email-modal-meta-value">{formatDateTime(email.date)}</span>
              </div>
              <div className="email-modal-meta-row">
                <span className="email-modal-meta-label">Subject</span>
                <span className="email-modal-meta-value email-modal-meta-value--strong">{email.subject || "—"}</span>
              </div>
            </div>

            <div className="email-modal-section">
              <div className="email-modal-section-title">Body</div>
              <div className="email-modal-body-text">{email.bodyText || "(empty)"}</div>
            </div>

            {email.attachments && email.attachments.length > 0 && (
              <div className="email-modal-section">
                <div className="email-modal-section-title">Attachments ({email.attachments.length})</div>
                <div className="email-modal-attachments">
                  {email.attachments.map((attachment) => (
                    <div className="email-modal-attachment-row" key={attachment.id}>
                      <Paperclip size={13} />
                      <span className="email-modal-attachment-name" title={attachment.fileName}>
                        {attachment.fileName}
                      </span>
                      <span className="email-modal-attachment-size">{formatSize(attachment.size)}</span>
                      <a
                        className="email-modal-download-btn"
                        href={`${BACKEND_URL}/api/emails/attachments/${attachment.id}/download`}
                        title={`Download ${attachment.fileName}`}
                      >
                        <Download size={13} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <a className="email-modal-download-original" href={`${BACKEND_URL}/api/emails/${email.id}/download`}>
              <Download size={14} />
              Download Original Email ({email.fileName})
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailDetailsModal;
