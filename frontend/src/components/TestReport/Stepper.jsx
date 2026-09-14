import React from "react";
import { Check } from "lucide-react";
import { useTranslation } from "../../i18n/LanguageContext";
import { STEPS } from "./testReportConstants";

// The numbered step nav at the top of the wizard — teal filled circle for
// the active step, checkmark for completed ones, plain outline for the
// rest. Clicking a step jumps straight to it (no forward/back restriction).
const Stepper = ({ activeStep, onSelectStep }) => {
  const { t } = useTranslation();

  return (
    <div className="testreport-stepper">
      {STEPS.map((stepKey, index) => (
        <React.Fragment key={stepKey}>
          <button type="button" className="testreport-step-btn" onClick={() => onSelectStep(index)}>
            <span className="testreport-step">
              <span
                className={[
                  "testreport-step-circle",
                  index === activeStep ? "active" : "",
                  index < activeStep ? "done" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {index < activeStep ? <Check size={14} /> : index + 1}
              </span>
              <span className={`testreport-step-label ${index === activeStep ? "active" : ""}`}>
                {t(`testReport.${stepKey}`)}
              </span>
            </span>
          </button>
          {index < STEPS.length - 1 && <span className="testreport-step-connector" />}
        </React.Fragment>
      ))}
    </div>
  );
};

export default Stepper;
