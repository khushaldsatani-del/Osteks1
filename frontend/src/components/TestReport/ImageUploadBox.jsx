import React, { useRef, useState } from "react";
import { UploadCloud, RefreshCw, X } from "lucide-react";
import { useTranslation } from "../../i18n/LanguageContext";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/tiff,.jpg,.jpeg,.png,.tif,.tiff";

// One "Before test" / "After N cycles" upload slot — click or drag-drop to
// select. `onSelect` just hands the File up to the parent, which shows it
// immediately from a local blob: URL; the real Cloud Storage upload is
// deferred to Save (see TestReport.jsx's image handlers), so there's no
// network round-trip to wait on here.
const ImageUploadBox = ({ label, image, onSelect, onRemove }) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) onSelect(file);
  };

  return (
    <div className="testreport-upload-col">
      <span className="testreport-upload-label">{label}</span>

      <div
        className={["testreport-upload-box", dragOver ? "dragover" : "", image ? "has-image" : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={image ? undefined : openPicker}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          hidden
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />

        {image ? (
          <>
            <img src={image.url} alt={label} className="testreport-upload-preview" />
            <div className="testreport-upload-overlay">
              <button type="button" onClick={openPicker} title={t("testReport.replaceImage")}>
                <RefreshCw size={13} />
              </button>
              <button type="button" onClick={onRemove} title={t("testReport.removeImage")}>
                <X size={13} />
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="testreport-upload-icon">
              <UploadCloud size={22} />
            </span>
            <strong>{t("testReport.clickToUpload")}</strong>
            <span className="testreport-upload-hint">{t("testReport.orDragDrop")}</span>
            <span className="testreport-upload-formats">{t("testReport.uploadFormats")}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default ImageUploadBox;
