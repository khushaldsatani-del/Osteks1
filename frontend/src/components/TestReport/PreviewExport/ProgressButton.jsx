import React, { useRef, useState } from "react";

// A button that fills with an animated "liquid" progress bar while its
// async action runs — used for Step 5's Speichern/Als Word herunterladen
// buttons, so the user gets real visual feedback for an operation that has
// no genuine byte-level progress to report (a JSON save round-trip,
// client-side .docx generation). The fill climbs toward ~92% on a simple
// decelerating timer (a well-known "simulated progress" pattern for
// exactly this kind of operation), jumps to 100% the moment the real
// action actually resolves, holds there briefly with a darker background,
// then resets — the button is disabled for that whole stretch so a second
// click can't start an overlapping save/download, but always re-enables
// afterward so the next real edit can still be saved/downloaded.
const HOLD_MS = 900;

const ProgressButton = ({ icon: Icon, idleLabel, doneLabel, errorLabel, onRun, className = "", disabled }) => {
  const [phase, setPhase] = useState("idle"); // idle | running | done | error
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = async () => {
    if (phase !== "idle" || disabled) return;
    setPhase("running");
    setProgress(6);
    timerRef.current = setInterval(() => {
      setProgress((p) => (p < 92 ? p + Math.max(0.6, (92 - p) / 14) : p));
    }, 110);

    // Error state comes from the promise itself rejecting — not from
    // re-reading some external "did it fail" flag afterward, which would
    // race against whatever state update caused that flag to change.
    let failed = false;
    try {
      await onRun();
    } catch {
      failed = true;
    } finally {
      stopTimer();
      setProgress(100);
      setPhase(failed ? "error" : "done");
      setTimeout(() => {
        setPhase("idle");
        setProgress(0);
      }, HOLD_MS);
    }
  };

  // While running, the label itself disappears in favor of a live 0→100%
  // count — the button reads as an actual progress readout, not just text
  // with a fill animating behind it — then flips to the done/error label
  // once the real action has actually settled.
  const label = phase === "done" ? doneLabel : phase === "error" ? errorLabel : idleLabel;

  return (
    <button
      type="button"
      className={`${className} progress-btn progress-btn--${phase}`}
      onClick={handleClick}
      disabled={phase !== "idle" || disabled}
    >
      <span className="progress-btn-fill" style={{ width: `${phase === "idle" ? 0 : progress}%` }} />
      <span className="progress-btn-label">
        {phase === "running" ? (
          <span className="progress-btn-percent">{Math.round(progress)}%</span>
        ) : (
          <>
            <Icon size={14} />
            {label}
          </>
        )}
      </span>
    </button>
  );
};

export default ProgressButton;
