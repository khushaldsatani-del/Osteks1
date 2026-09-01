import React from "react";
import { X, FileText, Mail, Sparkles, CircleCheck, Inbox } from "lucide-react";
import { useTranslation } from "../../i18n/LanguageContext";
import "./uploadInfoModal.css";

// Static, informational only — no data fetching. Explains the single
// combined drop zone (one place for both the drawing and its optional
// related email, sorted automatically by file type) and the AI/storage
// split so both are clear at a glance.
const UploadInfoModal = ({ onClose }) => {
  const { t } = useTranslation();
  return (
    <div className="upload-info-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="upload-info-card">
        <div className="upload-info-header">
          <h3 className="upload-info-title">{t("uploadInfoModal.title")}</h3>
          <button type="button" className="upload-info-close" onClick={onClose} aria-label={t("common.close")}>
            <X size={16} />
          </button>
        </div>

        <div className="upload-info-body">
          <div className="upload-info-row">
            <span className="upload-info-icon">
              <FileText size={15} />
            </span>
            <div>
              <div className="upload-info-row-title">{t("uploadInfoModal.row1Title")}</div>
              <div className="upload-info-row-text">{t("uploadInfoModal.row1Body")}</div>
            </div>
          </div>

          <div className="upload-info-row">
            <span className="upload-info-icon">
              <CircleCheck size={15} />
            </span>
            <div>
              <div className="upload-info-row-title">{t("uploadInfoModal.row2Title")}</div>
              <div className="upload-info-row-text">{t("uploadInfoModal.row2Body")}</div>
            </div>
          </div>

          <div className="upload-info-row">
            <span className="upload-info-icon">
              <Mail size={15} />
            </span>
            <div>
              <div className="upload-info-row-title">{t("uploadInfoModal.row3Title")}</div>
              <div className="upload-info-row-text">{t("uploadInfoModal.row3Body")}</div>
            </div>
          </div>

          <div className="upload-info-row">
            <span className="upload-info-icon">
              <Inbox size={15} />
            </span>
            <div>
              <div className="upload-info-row-title">{t("uploadInfoModal.row4Title")}</div>
              <div className="upload-info-row-text">{t("uploadInfoModal.row4Body")}</div>
            </div>
          </div>

          <div className="upload-info-row">
            <span className="upload-info-icon">
              <Sparkles size={15} />
            </span>
            <div>
              <div className="upload-info-row-title">{t("uploadInfoModal.row5Title")}</div>
              <div className="upload-info-row-text">{t("uploadInfoModal.row5Body")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadInfoModal;
