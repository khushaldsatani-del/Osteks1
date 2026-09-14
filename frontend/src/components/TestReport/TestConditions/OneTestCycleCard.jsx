import React from "react";
import { ArrowRight, Calendar, Info } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { getCyclePhases } from "../testReportConstants";
import BeforeTestingUploader from "./BeforeTestingUploader";

// "One Test Cycle (24 h) consists of:" — the salt spray / normal climate /
// humidity flow diagram plus the three colored detail cards below it, with
// a "Front part / Back part" reference photo uploader (BeforeTestingUploader)
// right under the heading, before the flow diagram.
const OneTestCycleCard = ({ referenceImages, setReferenceImage, swapReferenceImages }) => {
  const { t } = useTranslation();
  const cyclePhases = getCyclePhases(t);

  return (
    <div className="testreport-card">
      <p className="testreport-cycle-heading">{t("testReport.oneCycleConsistsOf")}</p>

      <BeforeTestingUploader images={referenceImages} onSelect={setReferenceImage} onSwap={swapReferenceImages} />

      <div className="testreport-flow">
        {cyclePhases.map((phase, index) => (
          <React.Fragment key={phase.key}>
            <div className={`testreport-flow-box testreport-theme--${phase.theme}`}>
              <span className="testreport-flow-icon">
                <phase.Icon size={20} />
              </span>
              <strong>{phase.flowTitle ?? phase.title}</strong>
              <span className="testreport-flow-standard">{phase.standard}</span>
              <span className="testreport-flow-duration">
                <Calendar size={12} />
                {phase.duration}
              </span>
            </div>
            {index < cyclePhases.length - 1 && (
              <span className="testreport-flow-arrow">
                <ArrowRight size={16} />
              </span>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="testreport-grid-3">
        {cyclePhases.map((phase) => (
          <div className={`testreport-phase-card testreport-theme--${phase.theme}`} key={phase.key}>
            <div className="testreport-phase-card-header">
              <strong>{phase.title}</strong>
              <span>{phase.standard}</span>
            </div>
            <div className="testreport-phase-card-rows">
              {phase.rows.map(([label, value]) => (
                <div className="testreport-phase-card-row" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="testreport-info-banner">
        <Info size={16} />
        <span>{t("testReport.restPeriodNote")}</span>
      </div>
    </div>
  );
};

export default OneTestCycleCard;
