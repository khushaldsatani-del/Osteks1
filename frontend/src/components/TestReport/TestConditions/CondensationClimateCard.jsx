import React from "react";
import { FlaskConical, Thermometer, Clock, ArrowRight, Layers, Info } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { getCwtSummary } from "../testReportConstants";
import BeforeTestingUploader from "./BeforeTestingUploader";

// Step 2's own summary card for the Condensation Water Constant Climate
// test — same test object/part/quantity Step 1 already collected (derived,
// not re-typed), Beginn/Ende typed here (cwtBegin/cwtEnd), everything else
// static reference content (see getCwtSummary).
const CondensationClimateCard = ({
  reportInfo,
  subjectTask,
  condensationDuration,
  cwtBegin,
  setCwtBegin,
  cwtEnd,
  setCwtEnd,
  referenceImages,
  setReferenceImage,
  swapReferenceImages,
}) => {
  const { t } = useTranslation();
  const CWT_SUMMARY = getCwtSummary(t, condensationDuration);

  return (
  <div className="testreport-card">
    <div className="testreport-card-header">
      <span className="testreport-card-icon">
        <FlaskConical size={14} />
      </span>
      <div className="testreport-delamination-title">
        <h3 className="testreport-card-title">{CWT_SUMMARY.title}</h3>
        <span className="testreport-delamination-standard">{CWT_SUMMARY.subtitle}</span>
      </div>
    </div>

    <BeforeTestingUploader images={referenceImages} onSelect={setReferenceImage} onSwap={swapReferenceImages} />

    <div className="testreport-flow testreport-cwt-summary-row">
      <div className="testreport-cwt-card testreport-cwt-card--orange">
        <span className="testreport-cwt-card-icon">
          <Thermometer size={18} />
        </span>
        <div className="testreport-cwt-card-body">
          <strong>{CWT_SUMMARY.testMethodLabel}</strong>
          <span>{CWT_SUMMARY.testMethodValue}</span>
        </div>
      </div>

      <span className="testreport-flow-arrow">
        <ArrowRight size={16} />
      </span>

      <div className="testreport-cwt-card testreport-cwt-card--blue">
        <span className="testreport-cwt-card-icon">
          <Clock size={18} />
        </span>
        <div className="testreport-cwt-card-body">
          <strong>{CWT_SUMMARY.durationLabel}</strong>
          <span>{CWT_SUMMARY.durationValue}</span>
        </div>
      </div>

      <span className="testreport-flow-arrow">
        <ArrowRight size={16} />
      </span>

      <div className="testreport-cwt-card testreport-cwt-card--green">
        <span className="testreport-cwt-card-icon">
          <FlaskConical size={18} />
        </span>
        <div className="testreport-cwt-card-body">
          <strong>{CWT_SUMMARY.partsLabel}</strong>
          <span>{reportInfo.testObjectPart || "—"}</span>
          <span className="testreport-cwt-card-subvalue">
            <Layers size={11} />
            {subjectTask.quantity || "—"} {t("testReport.sampleUnitsSuffix")}
          </span>
        </div>
      </div>
    </div>

    <div className="testreport-grid-3 testreport-cwt-detail-row">
      <div className="testreport-phase-card testreport-theme--orange">
        <div className="testreport-phase-card-header">
          <strong>{CWT_SUMMARY.conditionsTitle}</strong>
        </div>
        <div className="testreport-phase-card-rows">
          {CWT_SUMMARY.conditionsRows.map(([label, value]) => (
            <div className="testreport-phase-card-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="testreport-phase-card testreport-theme--blue">
        <div className="testreport-phase-card-header">
          <strong>{CWT_SUMMARY.equipmentTitle}</strong>
        </div>
        <div className="testreport-phase-card-rows">
          <div className="testreport-phase-card-text">
            {CWT_SUMMARY.equipmentLines.map((line, i) => (
              <React.Fragment key={line}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="testreport-phase-card testreport-theme--green">
        <div className="testreport-phase-card-header">
          <strong>{CWT_SUMMARY.periodTitle}</strong>
        </div>
        <div className="testreport-phase-card-rows">
          <div className="testreport-phase-card-row">
            <span>{CWT_SUMMARY.periodBeginLabel}</span>
            <input
              type="date"
              className="testreport-phase-card-date-input"
              value={cwtBegin}
              onChange={(event) => setCwtBegin(event.target.value)}
            />
          </div>
          <div className="testreport-phase-card-row">
            <span>{CWT_SUMMARY.periodEndLabel}</span>
            <input
              type="date"
              className="testreport-phase-card-date-input"
              value={cwtEnd}
              onChange={(event) => setCwtEnd(event.target.value)}
            />
          </div>
          <div className="testreport-phase-card-row">
            <span>{CWT_SUMMARY.periodTotalLabel}</span>
            <strong>{CWT_SUMMARY.durationValue}</strong>
          </div>
        </div>
      </div>
    </div>

    <div className="testreport-cwt-requirements">
      <Info size={16} />
      <div className="testreport-cwt-requirements-body">
        <strong>{CWT_SUMMARY.requirementsTitle}</strong>
        <div className="testreport-cwt-requirements-list">
          {CWT_SUMMARY.requirements.map((req, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <div className="testreport-cwt-requirement-item" key={index}>
              <span className="testreport-cwt-requirement-num">{index + 1}</span>
              <span className="testreport-cwt-requirement-text">
                {typeof req === "string" ? (
                  req
                ) : (
                  <>
                    {req.text}
                    <em>{req.note}</em>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
  );
};

export default CondensationClimateCard;
