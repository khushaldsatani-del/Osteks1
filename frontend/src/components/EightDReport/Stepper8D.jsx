import React from "react";
import { Check } from "lucide-react";
import { useTranslation } from "../../i18n/LanguageContext";
import { STEPS } from "./eightDReportConstants";

// Same numbered-step-nav pattern as Test Report's own Stepper.jsx (teal
// filled circle for the active step, checkmark for completed ones, plain
// outline for the rest) — kept as its own component rather than
// generalizing that one, so this page's navigation can evolve
// independently of Test Report's.
const Stepper8D = ({ activeStep, onSelectStep }) => {
  const { t } = useTranslation();

  return (
    <div className="eightd-stepper">
      {STEPS.map((stepKey, index) => (
        <React.Fragment key={stepKey}>
          <button type="button" className="eightd-step-btn" onClick={() => onSelectStep(index)}>
            <span className="eightd-step">
              <span
                className={["eightd-step-circle", index === activeStep ? "active" : "", index < activeStep ? "done" : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                {index < activeStep ? <Check size={14} /> : index + 1}
              </span>
              <span className={`eightd-step-label ${index === activeStep ? "active" : ""}`}>
                {t(`eightD.${stepKey}`)}
              </span>
            </span>
          </button>
          {index < STEPS.length - 1 && <span className="eightd-step-connector" />}
        </React.Fragment>
      ))}
    </div>
  );
};

export default Stepper8D;
