import React, { useRef, useState } from "react";
import { Package, ChevronUp, Plus, Trash2, Upload, X } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { getMaterialOptions, getCreatedByOptions } from "../testReportConstants";
import CustomSelect from "../../common/CustomSelect";

const SIGNATURE_ACCEPT = "image/jpeg,image/png,image/tiff,.jpg,.jpeg,.png,.tif,.tiff";

// "Subject / Test Task" — the second of Basic Information's two cards (see
// ReportInformationCard for the first). Owns its own collapse state, same
// as its sibling.
//
// Material is a fixed CustomSelect (exactly 3 choices — Black Sheet
// Steel/Aluminum/Galvanized Steel) — it used to be a free-text <input> +
// <datalist> combobox, but a native datalist can't reliably be reopened
// once its value already matches an option in some browsers, and the
// field never actually needed a "type your own" escape hatch. Created By
// stays an editable combobox (plain <input> + <datalist>, pick a
// suggestion or type your own) since any name can show up there. Surface /
// Protection Type is a plain text field (autofilled from the detected norm
// when the report was created from Document Preview's "Test required").
// Report Type / Specification / Coating were removed; a signature-image
// upload sits next to Created By (no preview shown — just a filename +
// remove).
const SubjectTaskCard = ({
  subjectTask,
  setSubjectField,
  setSubjectSelect,
  setTestValue,
  addTest,
  removeTest,
  setSignatureImage,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const signatureInputRef = useRef(null);

  return (
    <div className="testreport-card">
      <div className="testreport-card-header">
        <span className="testreport-card-icon">
          <Package size={14} />
        </span>
        <h3 className="testreport-card-title">{t("testReport.subjectTaskTitle")}</h3>
        <button
          type="button"
          className={`testreport-collapse-btn ${open ? "" : "collapsed"}`}
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle section"
        >
          <ChevronUp size={16} />
        </button>
      </div>

      {open && (
        <>
          <div className="testreport-grid-3">
            <div className="testreport-field">
              <label htmlFor="tr-testSample">{t("testReport.testSamplePattern")}</label>
              <input
                id="tr-testSample"
                type="text"
                value={subjectTask.testSample}
                onChange={setSubjectField("testSample")}
              />
            </div>

            <div className="testreport-field">
              <label htmlFor="tr-partNo">{t("testReport.partNo")}</label>
              <input id="tr-partNo" type="text" value={subjectTask.partNo} onChange={setSubjectField("partNo")} />
            </div>

            <div className="testreport-field">
              <label htmlFor="tr-drawingNo">{t("testReport.drawingNoOptional")}</label>
              <input
                id="tr-drawingNo"
                type="text"
                placeholder={t("testReport.enterDrawingNo")}
                value={subjectTask.drawingNo}
                onChange={setSubjectField("drawingNo")}
              />
            </div>
          </div>

          <div className="testreport-grid-3">
            <div className="testreport-field">
              <label htmlFor="tr-quantity">{t("testReport.quantity")}</label>
              <input
                id="tr-quantity"
                type="text"
                inputMode="numeric"
                value={subjectTask.quantity}
                onChange={setSubjectField("quantity")}
              />
            </div>

            <div className="testreport-field">
              <label htmlFor="tr-material">{t("testReport.material")}</label>
              <CustomSelect
                id="tr-material"
                value={subjectTask.material}
                onChange={setSubjectSelect("material")}
                options={getMaterialOptions(t)}
                placeholder={t("testReport.placeholderSelect")}
              />
            </div>

            <div className="testreport-field">
              <label htmlFor="tr-surfaceProtectionType">{t("testReport.surfaceProtectionType")}</label>
              <input
                id="tr-surfaceProtectionType"
                type="text"
                value={subjectTask.surfaceProtectionType}
                onChange={setSubjectField("surfaceProtectionType")}
              />
            </div>
          </div>

          <div className="testreport-tests">
            <div className="testreport-tests-header">
              <span className="testreport-tests-label">{t("testReport.tests")}</span>
              <button type="button" className="testreport-add-test" onClick={addTest}>
                <Plus size={13} />
                {t("testReport.addTest")}
              </button>
            </div>

            {subjectTask.tests.map((test, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div className="testreport-test-row" key={index}>
                <input
                  type="text"
                  placeholder={t("testReport.testPlaceholder")}
                  value={test}
                  onChange={(event) => setTestValue(index, event.target.value)}
                />
                <button
                  type="button"
                  className="testreport-test-remove"
                  onClick={() => removeTest(index)}
                  aria-label={t("testReport.removeTest")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <div className="testreport-grid-2">
            <div className="testreport-field">
              <label htmlFor="tr-createdBy">{t("testReport.createdBy")}</label>
              <input
                id="tr-createdBy"
                type="text"
                list="tr-createdby-list"
                placeholder={t("testReport.orTypeYourOwn")}
                value={subjectTask.createdBy}
                onChange={setSubjectField("createdBy")}
              />
              <datalist id="tr-createdby-list">
                {getCreatedByOptions(t).map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div className="testreport-field">
              <label>{t("testReport.signature")}</label>
              <input
                ref={signatureInputRef}
                type="file"
                accept={SIGNATURE_ACCEPT}
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setSignatureImage(file);
                  event.target.value = "";
                }}
              />
              {subjectTask.signature ? (
                <div className="testreport-signature-chip">
                  <span className="testreport-signature-name">
                    {subjectTask.signature.name || t("testReport.signature")}
                  </span>
                  <button
                    type="button"
                    className="testreport-signature-remove"
                    onClick={() => setSignatureImage(null)}
                    aria-label={t("testReport.removeImage")}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="testreport-signature-upload"
                  onClick={() => signatureInputRef.current?.click()}
                >
                  <Upload size={13} />
                  {t("testReport.uploadSignature")}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SubjectTaskCard;
