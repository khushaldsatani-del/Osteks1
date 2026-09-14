import React, { useState } from "react";
import { Image as ImageIcon, ArrowLeftRight, Info, Ruler, ChevronUp, X, Plus, Trash2, Droplets } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import CustomSelect from "../../common/CustomSelect";
import ImageUploadBox from "../ImageUploadBox";
import CrosscutTestCard from "./CrosscutTestCard";
import ResultsOverviewCard from "./ResultsOverviewCard";
import {
  getAssessmentOptions,
  getCrosscutCorrosionLabel,
  getCrosscutCondensationLabel,
  getInspectionCriteriaLabel,
  getInspectionRequirementLabel,
} from "../testReportConstants";

// The right-hand content area inside Results — dispatches on the active
// rail item: one of the two Cross-cut Test cards, a cycle checkpoint's
// photo+table (+ the two delamination-card variants), or the plain "not
// built yet" placeholder for Overview. This is the "content" half of
// Results' two components (see ResultsRail for the sidebar half).
const ResultsContent = ({
  activeSection,
  isLastCycle,
  cycle,
  resultsSection,
  durationCycles,
  evaluationSyncedRows,
  cycleSections,
  cyclesData,
  updateCycleRow,
  setCycleImage,
  swapCycleImages,
  setDelaminationField,
  setDelaminationImage,
  swapDelaminationImages,
  revealFinalDelamination,
  toggleFinalDelaminationOpen,
  closeFinalDelamination,
  setFinalDelaminationField,
  setFinalDelaminationImage,
  swapFinalDelaminationImages,
  addFinalDelaminationEntry,
  removeFinalDelaminationEntry,
  corrosionCrosscutData,
  setCorrosionCrosscutImage,
  swapCorrosionCrosscutImages,
  setCorrosionCrosscutField,
  condensationCrosscutData,
  setCondensationCrosscutImage,
  swapCondensationCrosscutImages,
  setCondensationCrosscutField,
  constantClimateData,
  setConstantClimateImage,
  swapConstantClimateImages,
  setConstantClimateField,
}) => {
  const { t } = useTranslation();
  const [constantClimateOpen, setConstantClimateOpen] = useState(true);
  const [delaminationOpen, setDelaminationOpen] = useState(true);

  if (activeSection.id === "crosscutCorrosion") {
    return (
      <CrosscutTestCard
        idPrefix="corrosion"
        testLabel={getCrosscutCorrosionLabel(t)}
        data={corrosionCrosscutData}
        setImage={setCorrosionCrosscutImage}
        swapImages={swapCorrosionCrosscutImages}
        setField={setCorrosionCrosscutField}
      />
    );
  }

  if (activeSection.id === "crosscutCondensation") {
    return (
      <CrosscutTestCard
        idPrefix="condensation"
        testLabel={getCrosscutCondensationLabel(t)}
        data={condensationCrosscutData}
        setImage={setCondensationCrosscutImage}
        swapImages={swapCondensationCrosscutImages}
        setField={setCondensationCrosscutField}
      />
    );
  }

  if (activeSection.id === "constantClimate") {
    return (
      <div className="testreport-card">
        <div className="testreport-card-header">
          <span className="testreport-card-icon">
            <Droplets size={14} />
          </span>
          <h3 className="testreport-card-title">{activeSection.label}</h3>
          <button
            type="button"
            className={`testreport-collapse-btn ${constantClimateOpen ? "" : "collapsed"}`}
            onClick={() => setConstantClimateOpen((open) => !open)}
            aria-label="Toggle section"
          >
            <ChevronUp size={16} />
          </button>
        </div>

        {constantClimateOpen && (
          <>
            <span className="testreport-tests-label">{t("testReport.uploadImage")}</span>

            <div className="testreport-photo-row">
              <ImageUploadBox
                label={t("testReport.beforeTest")}
                image={constantClimateData.beforeImage}
                onSelect={(file) => setConstantClimateImage("beforeImage", file)}
                onRemove={() => setConstantClimateImage("beforeImage", null)}
              />

              <button
                type="button"
                className="testreport-swap-btn"
                onClick={swapConstantClimateImages}
                title={t("testReport.swapImages")}
              >
                <ArrowLeftRight size={16} />
              </button>

              <ImageUploadBox
                label={t("testReport.afterTest")}
                image={constantClimateData.afterImage}
                onSelect={(file) => setConstantClimateImage("afterImage", file)}
                onRemove={() => setConstantClimateImage("afterImage", null)}
              />
            </div>

            {/* One description per image, not one shared — same "paired
                per side" rule the Cross-cut Test card follows. */}
            <div className="testreport-grid-2 testreport-crosscut-description">
              <div className="testreport-field">
                <label htmlFor="tr-constant-climate-description-before">
                  {t("testReport.description")} ({t("testReport.beforeTest")})
                </label>
                <textarea
                  id="tr-constant-climate-description-before"
                  placeholder={t("testReport.crosscutDescriptionPlaceholder")}
                  value={constantClimateData.descriptionBefore}
                  onChange={(event) => setConstantClimateField("descriptionBefore")(event.target.value)}
                />
              </div>

              <div className="testreport-field">
                <label htmlFor="tr-constant-climate-description-after">
                  {t("testReport.description")} ({t("testReport.afterTest")})
                </label>
                <textarea
                  id="tr-constant-climate-description-after"
                  placeholder={t("testReport.crosscutDescriptionPlaceholder")}
                  value={constantClimateData.descriptionAfter}
                  onChange={(event) => setConstantClimateField("descriptionAfter")(event.target.value)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (activeSection.kind === "cycles" && cycle) {
    return (
      <>
        <div className="testreport-card testreport-photo-card">
          <div className="testreport-card-header">
            <span className="testreport-card-icon">
              <ImageIcon size={14} />
            </span>
            <h3 className="testreport-card-title">{t("testReport.conditionAfterCycles", { count: activeSection.cycles })}</h3>
          </div>

          <span className="testreport-tests-label">{t("testReport.uploadImages")}</span>

          <div className="testreport-photo-row">
            <ImageUploadBox
              label={t("testReport.beforeTest")}
              image={cycle.beforeImage}
              onSelect={(file) => setCycleImage(resultsSection, "beforeImage", file)}
              onRemove={() => setCycleImage(resultsSection, "beforeImage", null)}
            />

            <button
              type="button"
              className="testreport-swap-btn"
              onClick={() => swapCycleImages(resultsSection)}
              title={t("testReport.swapImages")}
            >
              <ArrowLeftRight size={16} />
            </button>

            <ImageUploadBox
              label={t("testReport.afterTest")}
              image={cycle.afterImage}
              onSelect={(file) => setCycleImage(resultsSection, "afterImage", file)}
              onRemove={() => setCycleImage(resultsSection, "afterImage", null)}
            />

            <div className="testreport-photo-note">
              <span className="testreport-photo-note-title">
                <Info size={14} />
                {t("testReport.noteTitle")}
              </span>
              <ul>
                <li>{t("testReport.noteBullet1")}</li>
                <li>{t("testReport.noteBullet2")}</li>
                <li>{t("testReport.noteBullet3")}</li>
                <li>{t("testReport.noteBullet4")}</li>
              </ul>
            </div>
          </div>

          <hr className="testreport-card-divider" />

          <h3 className="testreport-results-heading testreport-results-heading--tight">
            {activeSection.label} – {t("testReport.testResults")}
          </h3>

          <div className="testreport-table-wrap">
            <table className="testreport-table">
              <thead>
                <tr>
                  <th>{t("testReport.colNo")}</th>
                  <th>{t("testReport.colCriteria")}</th>
                  <th>{t("testReport.colObservation")}</th>
                  <th>{t("testReport.colRequirement")}</th>
                  <th>{t("testReport.colAssessment")}</th>
                </tr>
              </thead>
              <tbody>
                {cycle.rows.map((row, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{getInspectionCriteriaLabel(t, row.id)}</td>
                    <td>
                      <input
                        type="text"
                        value={row.observation}
                        onChange={updateCycleRow(resultsSection, index, "observation")}
                      />
                    </td>
                    <td>{getInspectionRequirementLabel(t, row.id)}</td>
                    <td>
                      <div className={`testreport-assessment testreport-assessment--${row.assessment.toLowerCase()}`}>
                        <CustomSelect
                          value={row.assessment}
                          onChange={updateCycleRow(resultsSection, index, "assessment")}
                          options={getAssessmentOptions(t)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Follow-up scratch-delamination measurement (ISO 4628-8) — only
            appears once an inspection row above actually needs it (any
            Fail/Conditional verdict, "Others" included), never shown while
            every row still reads Pass. Unchanged behavior, except it no
            longer applies to the LAST cycle checkpoint — that one uses
            finalDelamination below instead, button-revealed rather than
            auto-triggered. */}
        {!isLastCycle && cycle.rows.some((row) => row.assessment !== "Pass") && (
          <div className="testreport-card">
            <div className="testreport-card-header">
              <span className="testreport-card-icon">
                <Ruler size={14} />
              </span>
              <div className="testreport-delamination-title">
                <h3 className="testreport-card-title">{t("testReport.delaminationTitle")}</h3>
                <span className="testreport-delamination-standard">DIN EN ISO 4628-8</span>
              </div>
              <button
                type="button"
                className={`testreport-collapse-btn ${delaminationOpen ? "" : "collapsed"}`}
                onClick={() => setDelaminationOpen((open) => !open)}
                aria-label="Toggle section"
              >
                <ChevronUp size={16} />
              </button>
            </div>

            {delaminationOpen && (
              <>
                <div className="testreport-grid-3">
                  <div className="testreport-field">
                    <label htmlFor="tr-verfahren">{t("testReport.verfahren")}</label>
                    <input
                      id="tr-verfahren"
                      type="text"
                      value={cycle.delamination.verfahren}
                      onChange={(event) => setDelaminationField(resultsSection, "verfahren")(event.target.value)}
                    />
                  </div>
                </div>

                <span className="testreport-tests-label testreport-delamination-upload-label">{t("testReport.uploadImage")}</span>

                <div className="testreport-photo-row">
                  <ImageUploadBox
                    label={t("testReport.beforeTest")}
                    image={cycle.delamination.beforeImage}
                    onSelect={(file) => setDelaminationImage(resultsSection, "beforeImage", file)}
                    onRemove={() => setDelaminationImage(resultsSection, "beforeImage", null)}
                  />

                  <button
                    type="button"
                    className="testreport-swap-btn"
                    onClick={() => swapDelaminationImages(resultsSection)}
                    title={t("testReport.swapImages")}
                  >
                    <ArrowLeftRight size={16} />
                  </button>

                  <ImageUploadBox
                    label={t("testReport.afterTest")}
                    image={cycle.delamination.afterImage}
                    onSelect={(file) => setDelaminationImage(resultsSection, "afterImage", file)}
                    onRemove={() => setDelaminationImage(resultsSection, "afterImage", null)}
                  />
                </div>

                <div className="testreport-grid-2">
                  <div className="testreport-field">
                    <label htmlFor="tr-dBefore">{t("testReport.delaminationValueLabel")}</label>
                    <input
                      id="tr-dBefore"
                      type="text"
                      placeholder={t("testReport.delaminationBeforeExample")}
                      value={cycle.delamination.dBefore}
                      onChange={(event) => setDelaminationField(resultsSection, "dBefore")(event.target.value)}
                    />
                  </div>

                  <div className="testreport-field">
                    <label htmlFor="tr-dAfter">{t("testReport.delaminationValueLabel")}</label>
                    <input
                      id="tr-dAfter"
                      type="text"
                      placeholder={t("testReport.delaminationAfterExample")}
                      value={cycle.delamination.dAfter}
                      onChange={(event) => setDelaminationField(resultsSection, "dAfter")(event.target.value)}
                    />
                  </div>
                </div>

                <div className="testreport-info-banner">
                  <Info size={16} />
                  <span>{t("testReport.delaminationNote")}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Final delamination measurement — only offered at the LAST cycle
            checkpoint, and only once the user actually asks for it (never
            auto-triggered by a Fail/Conditional row, unlike the card
            above). Adds a Cycle number + "+ Add" so more than one
            checkpoint's reading can be logged here (e.g. re-checked at 30
            and again at the true final 60), which the "in between" version
            above doesn't need since it only ever applies to its own single
            cycle. */}
        {isLastCycle && !cycle.finalDelamination.revealed && (
          <button
            type="button"
            className="testreport-btn testreport-add-delamination-btn"
            onClick={() => revealFinalDelamination(resultsSection)}
          >
            <Ruler size={14} />
            {t("testReport.addDelaminationMeasurement")}
          </button>
        )}

        {isLastCycle && cycle.finalDelamination.revealed && (
          <div className="testreport-card">
            <div className="testreport-card-header">
              <span className="testreport-card-icon">
                <Ruler size={14} />
              </span>
              <div className="testreport-delamination-title">
                <h3 className="testreport-card-title">{t("testReport.delaminationTitle")}</h3>
                <span className="testreport-delamination-standard">DIN EN ISO 4628-8</span>
              </div>
              <button
                type="button"
                className={`testreport-collapse-btn ${cycle.finalDelamination.open ? "" : "collapsed"}`}
                onClick={() => toggleFinalDelaminationOpen(resultsSection)}
                aria-label="Toggle section"
              >
                <ChevronUp size={16} />
              </button>

              <button
                type="button"
                className="testreport-close-btn"
                onClick={() => closeFinalDelamination(resultsSection)}
                aria-label={t("testReport.closeSection")}
                title={t("testReport.closeSection")}
              >
                <X size={16} />
              </button>
            </div>

            {cycle.finalDelamination.open && (
              <>
                <div className="testreport-final-delam-row">
                  <div className="testreport-field testreport-final-delam-procedure">
                    <label htmlFor="tr-final-verfahren">{t("testReport.verfahren")}</label>
                    <input
                      id="tr-final-verfahren"
                      type="text"
                      value={cycle.finalDelamination.procedure}
                      onChange={(event) => setFinalDelaminationField(resultsSection, "procedure")(event.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className="testreport-final-delam-add"
                    onClick={() => addFinalDelaminationEntry(resultsSection)}
                  >
                    <Plus size={13} />
                    {t("testReport.add")}
                  </button>
                </div>

                <span className="testreport-tests-label testreport-delamination-upload-label">{t("testReport.uploadImage")}</span>

                <div className="testreport-photo-row">
                  <ImageUploadBox
                    label={t("testReport.beforeTest")}
                    image={cycle.finalDelamination.beforeImage}
                    onSelect={(file) => setFinalDelaminationImage(resultsSection, "beforeImage", file)}
                    onRemove={() => setFinalDelaminationImage(resultsSection, "beforeImage", null)}
                  />

                  <button
                    type="button"
                    className="testreport-swap-btn"
                    onClick={() => swapFinalDelaminationImages(resultsSection)}
                    title={t("testReport.swapImages")}
                  >
                    <ArrowLeftRight size={16} />
                  </button>

                  <ImageUploadBox
                    label={t("testReport.afterTest")}
                    image={cycle.finalDelamination.afterImage}
                    onSelect={(file) => setFinalDelaminationImage(resultsSection, "afterImage", file)}
                    onRemove={() => setFinalDelaminationImage(resultsSection, "afterImage", null)}
                  />
                </div>

                {/* D= and Cycle are paired per side now — the Before photo
                    and the After photo can each have been taken at a
                    different cycle checkpoint, so its D reading carries
                    its own cycle number rather than one shared for the
                    whole card. */}
                <div className="testreport-final-delam-values">
                  <div className="testreport-field">
                    <label htmlFor="tr-final-dBefore">{t("testReport.delaminationValueLabel")}</label>
                    <input
                      id="tr-final-dBefore"
                      type="text"
                      placeholder={t("testReport.delaminationBeforeExample")}
                      value={cycle.finalDelamination.dBefore}
                      onChange={(event) => setFinalDelaminationField(resultsSection, "dBefore")(event.target.value)}
                    />
                  </div>

                  <div className="testreport-field">
                    <label htmlFor="tr-final-cycleBefore">{t("testReport.cycleLabel")}</label>
                    <input
                      id="tr-final-cycleBefore"
                      type="number"
                      placeholder={t("testReport.enterCycle")}
                      value={cycle.finalDelamination.cycleBefore}
                      onChange={(event) => setFinalDelaminationField(resultsSection, "cycleBefore")(event.target.value)}
                    />
                  </div>

                  <div className="testreport-field">
                    <label htmlFor="tr-final-dAfter">{t("testReport.delaminationValueLabel")}</label>
                    <input
                      id="tr-final-dAfter"
                      type="text"
                      placeholder={t("testReport.delaminationAfterExample")}
                      value={cycle.finalDelamination.dAfter}
                      onChange={(event) => setFinalDelaminationField(resultsSection, "dAfter")(event.target.value)}
                    />
                  </div>

                  <div className="testreport-field">
                    <label htmlFor="tr-final-cycleAfter">{t("testReport.cycleLabel")}</label>
                    <input
                      id="tr-final-cycleAfter"
                      type="number"
                      placeholder={t("testReport.enterCycle")}
                      value={cycle.finalDelamination.cycleAfter}
                      onChange={(event) => setFinalDelaminationField(resultsSection, "cycleAfter")(event.target.value)}
                    />
                  </div>
                </div>

                <div className="testreport-info-banner">
                  <Info size={16} />
                  <span>{t("testReport.delaminationNote")}</span>
                </div>

                {/* Every "+ Add"-ed entry — a full logged measurement
                    (procedure, both photos, both D/cycle pairs), not just
                    a text tag, since "+ Add" now snapshots the whole
                    fieldset above rather than one field. */}
                {cycle.finalDelamination.entries.length > 0 && (
                  <div className="testreport-final-delam-entries">
                    {cycle.finalDelamination.entries.map((entry) => (
                      <div className="testreport-final-delam-entry" key={entry.id}>
                        <div className="testreport-final-delam-entry-thumbs">
                          {entry.beforeImage ? (
                            <img src={entry.beforeImage.url} alt={t("testReport.beforeTest")} />
                          ) : (
                            <span className="testreport-final-delam-entry-thumb-empty" />
                          )}
                          {entry.afterImage ? (
                            <img src={entry.afterImage.url} alt={t("testReport.afterTest")} />
                          ) : (
                            <span className="testreport-final-delam-entry-thumb-empty" />
                          )}
                        </div>
                        <div className="testreport-final-delam-entry-text">
                          <strong>{entry.procedure || "—"}</strong>
                          <span>
                            {t("testReport.delaminationValueLabel")} {entry.dBefore || "—"}
                            {entry.cycleBefore ? ` (${t("testReport.cycleChip", { cycle: entry.cycleBefore })})` : ""}
                            {" → "}
                            {entry.dAfter || "—"}
                            {entry.cycleAfter ? ` (${t("testReport.cycleChip", { cycle: entry.cycleAfter })})` : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="testreport-final-delam-entry-remove"
                          onClick={() => removeFinalDelaminationEntry(resultsSection, entry.id)}
                          aria-label={t("testReport.removeTest")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </>
    );
  }

  if (activeSection.id === "overview") {
    return (
      <ResultsOverviewCard
        durationCycles={durationCycles}
        evaluationSyncedRows={evaluationSyncedRows}
        cycleSections={cycleSections}
        cyclesData={cyclesData}
      />
    );
  }

  return (
    <div className="testreport-card">
      <div className="testreport-placeholder">
        <strong>{activeSection.label}</strong>
        <span>{t("testReport.comingSoonBody")}</span>
      </div>
    </div>
  );
};

export default ResultsContent;
