import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "../../i18n/LanguageContext";

// The backend runs this as one blocking request (upload -> convert -> AI
// stage 1 -> AI stage 2 -> respond) with no progress channel back to the
// browser today, so these 6 steps are a timed approximation of the real
// pipeline phases, not literal backend telemetry.
//
// `stepStartedAt` (a wall-clock timestamp, set once by Documents.jsx when
// this slot's extraction began) is what actually drives which step shows —
// NOT a local counter. Deriving "current step" from Date.now() -
// stepStartedAt on every render means a slot's progress is correct the
// instant it's viewed regardless of whether this component happened to be
// mounted the whole time: switching away to review another image's
// already-finished result and back doesn't restart or freeze anything,
// it just recomputes from real elapsed time — the same mechanism that
// makes every slot's progress fully independent of every other slot's,
// with zero extra state to keep in sync between them.
const STEP_KEYS = [
  "extractionSteps.step1",
  "extractionSteps.step2",
  "extractionSteps.step3",
  "extractionSteps.step4",
  "extractionSteps.step5",
  "extractionSteps.step6",
];

// A typical real extraction runs well past a minute (multi-tile drawings,
// two AI passes each), so a short fixed interval used to blow through all
// 6 steps in ~12s and then sit motionless on step 6 for the rest of the
// wait — steps 1-5 finishing "instantly" while step 6 hung indefinitely.
// This spreads the 6 steps across a window that actually resembles a real
// extraction's total duration instead of front-loading them.
const STEP_INTERVAL_MS = 6500;

const ExtractionSteps = ({ stepStartedAt = null }) => {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  // Purely a render tick while this is mounted and visible — the actual
  // step number below is always recomputed from stepStartedAt, never from
  // this counter, so a gap in ticking (e.g. the tab was inactive) never
  // desyncs the displayed step from where the real elapsed time says it
  // should be.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(interval);
  }, []);

  const elapsedMs = Math.max(0, now - (stepStartedAt ?? now));
  const currentStep = Math.min(STEP_KEYS.length, Math.floor(elapsedMs / STEP_INTERVAL_MS) + 1);
  const [dots, setDots] = useState(1);

  // A real extraction (especially a large or multi-tile drawing) can easily
  // run past all 6 timed steps before the actual response lands — once
  // that happens, an animated ellipsis on the last step keeps the wait
  // visibly alive instead of sitting frozen on one label indefinitely.
  useEffect(() => {
    if (currentStep < STEP_KEYS.length) return undefined;
    const interval = setInterval(() => setDots((prev) => (prev % 3) + 1), 450);
    return () => clearInterval(interval);
  }, [currentStep]);

  return (
    <div className="extraction-steps">
      {STEP_KEYS.map((key, index) => {
        const stepNumber = index + 1;
        const isDone = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;
        const isLast = stepNumber === STEP_KEYS.length;
        const label = t(key);
        const displayLabel = isActive && isLast ? `${label}${".".repeat(dots)}` : label;

        return (
          <div className={`extraction-step ${isDone ? "extraction-step--done" : ""} ${isActive ? "extraction-step--active" : ""}`} key={key}>
            <div className="extraction-step-marker">
              {isDone ? <Check size={12} /> : stepNumber}
            </div>
            <div className="extraction-step-label">{displayLabel}</div>
            {stepNumber < STEP_KEYS.length && <div className="extraction-step-connector" />}
          </div>
        );
      })}
    </div>
  );
};

export default ExtractionSteps;
