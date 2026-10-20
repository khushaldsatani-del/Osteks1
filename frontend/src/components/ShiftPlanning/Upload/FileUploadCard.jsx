import React, { useRef, useState } from "react";
import { CloudUpload, LoaderCircle } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../shared/ShiftCard";
import ValidationPanel from "./ValidationPanel";
import { CURRENT_USER, FILE_TYPES, STATUS_META } from "./uploadData";
import { validateExcelFile } from "./validateExcelFile";
import { formatDateDots, formatDateTimeDots, formatFileSize } from "../shared/shiftFormat";

// One file type's card (ERP Export or ZWZ): drop zone / file picker, the
// file uploaded on the chosen day with its status, and its validation.
const FileUploadCard = ({ type, entry, date, onUploaded }) => {
  const { t, language } = useTranslation();
  const { icon: Icon, requiredColumns } = FILE_TYPES[type];
  const inputRef = useRef(null);
  const [checking, setChecking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [validationOpen, setValidationOpen] = useState(true);

  const handleFile = async (file) => {
    if (!file || checking) return;
    setChecking(true);
    try {
      const result = await validateExcelFile(file, requiredColumns);
      onUploaded({
        id: `upload-${Date.now()}`,
        type,
        fileName: file.name,
        uploadedAt: new Date(),
        size: file.size,
        user: CURRENT_USER,
        file,
        ...result,
      });
      setValidationOpen(true);
    } finally {
      setChecking(false);
    }
  };

  const status = entry ? STATUS_META[entry.status] : null;
  const StatusIcon = status?.icon;

  return (
    <ShiftCard
      className="supl-card"
      heading={
        <div className="supl-card-heading">
          <span className={`supl-type-icon supl-type-icon--${type}`}>
            <Icon size={20} />
          </span>
          <div>
            <h3 className="sp-card-title">{t(`shiftUpload.${type}Title`)}</h3>
            <p className="sp-card-subtitle">{t(`shiftUpload.${type}Hint`)}</p>
          </div>
        </div>
      }
    >
      <div
        className={`supl-drop ${dragging ? "is-dragging" : ""} ${checking ? "is-checking" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFile(event.dataTransfer.files?.[0]);
        }}
      >
        {checking ? (
          <>
            <LoaderCircle size={28} className="supl-drop-icon supl-spin" />
            <p className="supl-drop-title">{t("shiftUpload.checking")}</p>
          </>
        ) : (
          <>
            <CloudUpload size={30} className="supl-drop-icon" />
            <p className="supl-drop-title">{t(`shiftUpload.${type}Drop`)}</p>
            <p className="supl-drop-or">{t("shiftUpload.or")}</p>
            <button type="button" className="supl-select" onClick={() => inputRef.current?.click()}>
              {t("shiftUpload.selectFile")}
            </button>
            <p className="supl-drop-hint">{t("shiftUpload.supported")}</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      {entry ? (
        <>
          <div className={`supl-current supl-current--${status.tone}`}>
            <span className="supl-current-icon">
              <StatusIcon size={20} />
            </span>
            <div className="supl-current-info">
              <p className="supl-current-name" title={entry.fileName}>
                {entry.fileName}
              </p>
              <p className="supl-current-meta">
                <span>{t("shiftUpload.uploadedLabel", { date: formatDateTimeDots(entry.uploadedAt) })}</span>
                <span>{t("shiftUpload.sizeLabel", { size: formatFileSize(language, entry.size) })}</span>
              </p>
            </div>
            <span className={`supl-badge supl-badge--${status.tone}`}>
              <StatusIcon size={13} />
              {t(`shiftUpload.badge_${entry.status}`)}
            </span>
          </div>

          <ValidationPanel entry={entry} open={validationOpen} onToggle={() => setValidationOpen((v) => !v)} />
        </>
      ) : (
        <p className="supl-current-empty">
          {t("shiftUpload.noFile", { type: t(`shiftUpload.${type}Title`), date: formatDateDots(date) })}
        </p>
      )}
    </ShiftCard>
  );
};

export default FileUploadCard;
