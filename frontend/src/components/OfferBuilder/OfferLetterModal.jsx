import React, { useEffect } from "react";
import { X } from "lucide-react";
import DocPreview from "../DocPreview/DocPreview";
import { useTranslation } from "../../i18n/LanguageContext";
import "./offerLetterModal.css";

// "View offer": Work Place's Document Preview - the offer letter with its
// PDF / Word download and "Test erforderlich" - opened on top of the page.
// Deliberately outside the builder's .ob styles, so the letter renders
// exactly as it always has.
const OfferLetterModal = ({ onClose, ...previewProps }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="ob-letter-layer" role="dialog" aria-modal="true" aria-label={t("docPreview.title")}>
      <button type="button" className="ob-letter-backdrop" aria-label={t("common.close")} tabIndex={-1} onClick={onClose} />
      <div className="ob-letter-sheet">
        <button type="button" className="ob-letter-close" onClick={onClose} aria-label={t("common.close")}>
          <X size={18} />
        </button>
        <DocPreview {...previewProps} />
      </div>
    </div>
  );
};

export default OfferLetterModal;
