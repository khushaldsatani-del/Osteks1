import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useTranslation } from "../../i18n/LanguageContext";
import "./specificationModal.css";

// requirement_type -> translation key, for the handful of KB fact types
// that actually turn up in an Ofl-code lookup (see backend/services/
// kb_repo.py's lookup_specification). Any type not listed here still
// renders — just with its raw underscored name as a readable fallback —
// so a future KB fact type can never make a row silently disappear.
const FACT_LABEL_KEYS = {
  coating_thickness_range: "specificationModal.factCoatingThickness",
  cyclic_corrosion_cycles: "specificationModal.factCorrosionCycles",
  delamination_max: "specificationModal.factDelaminationMax",
  condensation_test_duration: "specificationModal.factCondensationDuration",
};

function factLabel(t, fact) {
  const key = FACT_LABEL_KEYS[fact.label];
  if (key) return t(key);
  return fact.label.replace(/_/g, " ");
}

// Everything shown here comes straight from the record's own already-fetched
// kbSpecification (see Documents.jsx's kbLookup.js) — no separate fetch on
// open, unlike EmailDetailsModal, since the data is already sitting on the
// row passed in from All Documents.
const SpecificationModal = ({ specification, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!specification) return null;

  const { code, documentNumber, meaning, governingDocument, thickness, keyFacts } = specification;

  return (
    <div className="spec-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="spec-modal-card">
        <div className="spec-modal-header">
          <h3 className="spec-modal-title">
            {t("specificationModal.title")}
            {code ? ` — Ofl-${code}` : documentNumber ? ` — ${documentNumber}` : ""}
          </h3>
          <button type="button" className="spec-modal-close" onClick={onClose} aria-label={t("common.close")}>
            <X size={16} />
          </button>
        </div>

        <div className="spec-modal-body">
          <div className="spec-modal-meta">
            <div className="spec-modal-meta-row">
              <span className="spec-modal-meta-label">{t("specificationModal.norm")}</span>
              <span className="spec-modal-meta-value spec-modal-meta-value--strong">{documentNumber || "—"}</span>
            </div>
            {governingDocument && (
              <div className="spec-modal-meta-row">
                <span className="spec-modal-meta-label">{t("specificationModal.governingDocument")}</span>
                <span className="spec-modal-meta-value">{governingDocument}</span>
              </div>
            )}
            <div className="spec-modal-meta-row">
              <span className="spec-modal-meta-label">{t("specificationModal.meaning")}</span>
              <span className="spec-modal-meta-value">{meaning || "—"}</span>
            </div>
            {thickness && (
              <div className="spec-modal-meta-row">
                <span className="spec-modal-meta-label">{t("specificationModal.thickness")}</span>
                <span className="spec-modal-meta-value spec-modal-meta-value--strong">
                  {thickness.min}–{thickness.max} {thickness.unit}
                </span>
              </div>
            )}
          </div>

          {keyFacts && keyFacts.length > 0 && (
            <div className="spec-modal-section">
              <div className="spec-modal-section-title">{t("specificationModal.keyFacts")}</div>
              <div className="spec-modal-facts-table-wrap">
                <table className="spec-modal-facts-table">
                  <thead>
                    <tr>
                      <th>{t("specificationModal.factColumn")}</th>
                      <th>{t("specificationModal.valueColumn")}</th>
                      <th>{t("specificationModal.detailColumn")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keyFacts.map((fact, index) => (
                      <tr key={index}>
                        <td>{factLabel(t, fact)}</td>
                        <td>
                          {fact.value}
                          {fact.unit ? ` ${fact.unit}` : ""}
                        </td>
                        <td className="spec-modal-facts-detail">{fact.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpecificationModal;
