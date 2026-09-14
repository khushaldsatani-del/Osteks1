import React, { useState } from "react";
import { ArrowLeftRight, ChevronUp, Scissors } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ImageUploadBox from "../ImageUploadBox";

// One Cross-cut Test card — used twice (see ResultsContent.jsx), once for
// the Corrosion Change Test and once for the Condensation Water Constant
// Climate test, each shown only when that test actually applies to this
// report (see testReportConstants.js's buildResultSections). No dropdown
// anymore — `testLabel` is fixed per instance, since which test this card
// belongs to is no longer a user choice, just which of the two rail items
// is currently active.
const CrosscutTestCard = ({ idPrefix, testLabel, data, setImage, swapImages, setField }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <div className="testreport-card">
      <div className="testreport-card-header">
        <span className="testreport-card-icon">
          <Scissors size={14} />
        </span>
        <div className="testreport-delamination-title">
          <h3 className="testreport-card-title">{t("testReport.crosscutTitle")}</h3>
          <span className="testreport-delamination-standard">DIN EN ISO 2409</span>
        </div>
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
          <span className="testreport-crosscut-upload-label">
            {t("testReport.crosscutUploadFor", { test: testLabel })}
          </span>

          <div className="testreport-photo-row">
            <ImageUploadBox
              label={t("testReport.beforeTest")}
              image={data.beforeImage}
              onSelect={(file) => setImage("beforeImage", file)}
              onRemove={() => setImage("beforeImage", null)}
            />

            <button type="button" className="testreport-swap-btn" onClick={swapImages} title={t("testReport.swapImages")}>
              <ArrowLeftRight size={16} />
            </button>

            <ImageUploadBox
              label={t("testReport.afterTest")}
              image={data.afterImage}
              onSelect={(file) => setImage("afterImage", file)}
              onRemove={() => setImage("afterImage", null)}
            />
          </div>

          <div className="testreport-grid-3">
            <div className="testreport-field">
              <label htmlFor={`tr-crosscut-grade-${idPrefix}`}>{t("testReport.crosscutGrade")}</label>
              <input
                id={`tr-crosscut-grade-${idPrefix}`}
                type="text"
                placeholder={t("testReport.crosscutGradePlaceholder")}
                value={data.grade || ""}
                onChange={(event) => setField("grade")(event.target.value)}
              />
            </div>
          </div>

          {/* One description per image, not one shared — each side
              (Front/Back) gets its own text, same "paired per side" rule
              the final delamination card's D=/Cycle fields follow. */}
          <div className="testreport-grid-2 testreport-crosscut-description">
            <div className="testreport-field">
              <label htmlFor={`tr-crosscut-description-before-${idPrefix}`}>
                {t("testReport.description")} ({t("testReport.beforeTest")})
              </label>
              <textarea
                id={`tr-crosscut-description-before-${idPrefix}`}
                placeholder={t("testReport.crosscutDescriptionPlaceholder")}
                value={data.descriptionBefore}
                onChange={(event) => setField("descriptionBefore")(event.target.value)}
              />
            </div>

            <div className="testreport-field">
              <label htmlFor={`tr-crosscut-description-after-${idPrefix}`}>
                {t("testReport.description")} ({t("testReport.afterTest")})
              </label>
              <textarea
                id={`tr-crosscut-description-after-${idPrefix}`}
                placeholder={t("testReport.crosscutDescriptionPlaceholder")}
                value={data.descriptionAfter}
                onChange={(event) => setField("descriptionAfter")(event.target.value)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CrosscutTestCard;
