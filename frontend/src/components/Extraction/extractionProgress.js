// Turns the backend's REAL progress events (see backend/main.py's
// /api/extract-stream and /api/extract-email-stream) into one 0-100 number
// for the extraction progress bar.
//
// What is genuinely measured vs. estimated — kept honest on purpose:
//   - Upload: exact (bytes sent / bytes total, from the browser itself).
//   - Every phase boundary (file received, converted, stage 1 / stage 2
//     started and finished): exact — the bar only ever moves past a
//     boundary when the server actually reports crossing it.
//   - Each AI stage has two parts. Its silent "reasoning" part produces no
//     data at all (the model's thinking tokens are never streamed), so the
//     only honest signal there is elapsed time against a learned expected
//     duration; its "output" part streams visible tokens, so that part is an
//     exact count against the typical answer size.
// The bar never moves backwards, never reaches 100% until the caller says
// the extracted details have actually been applied, and if the AI takes
// longer than expected it slows down toward (but never reaches) the end of
// its current stage instead of freezing or lying.

// Share of a single file's 0-100 range each phase owns. The two AI stages
// split ~65/35 — measured from real production runs (stage 1's answer is
// roughly twice the size of stage 2's, and reasoning time follows output
// size); everything before/after is small and fast.
const PHASES = {
  upload: [0, 3],
  prepare: [3, 7],
  stage1: [7, 64],
  stage2: [64, 95],
  finalize: [95, 100],
};

// What each kind of extraction looks like, measured from real runs — the
// two AI pipelines have the same two-stage shape but very different output
// sizes. `reasoningShare` is how much of a stage's total time is the silent
// thinking part (the rest is the visible answer being written);
// `expectedOutputChunks` is the typical size of that answer in streamed
// chunks (≈ tokens); `defaultStage1Seconds` is only used until this
// browser has run one extraction of its own (see loadExpectedStage1Seconds);
// stage 2 has run between ~0.4x and ~0.8x of stage 1's duration.
//   - Drawing: stage 1 ≈ 3/4 reasoning, ~0.9-2k chunks of output; stage 2
//     is almost all reasoning (its visible answer is ~100-200 tokens).
//   - Email: stage 1 is only ≈ half reasoning — it then streams a long
//     candidate list (~3k chunks in a real 2-part run); stage 2 is ≈ 88%
//     reasoning followed by ~450 chunks of structured per-part JSON.
const PROFILES = {
  drawing: {
    reasoningShare: { 1: 0.75, 2: 0.95 },
    expectedOutputChunks: { 1: 1500, 2: 150 },
    defaultStage1Seconds: 75,
    expectedPrepareSeconds: 3,
    stage2Ratio: 0.6,
    historyKey: "osteks.extraction.stage1Seconds",
    labelSuffix: "",
  },
  email: {
    reasoningShare: { 1: 0.5, 2: 0.88 },
    expectedOutputChunks: { 1: 2200, 2: 450 },
    defaultStage1Seconds: 55,
    expectedPrepareSeconds: 1,
    stage2Ratio: 0.6,
    historyKey: "osteks.extraction.email.stage1Seconds",
    labelSuffix: "Email",
  },
};

// When a real event moves the true value forward by a lot at once (e.g. the
// model starts writing its answer sooner than the time-based estimate
// expected), the displayed value glides there at this speed instead of
// teleporting. It only ever catches UP to the true value — never runs ahead
// of it — so smoothing can't make the bar claim more than is really done.
const CATCH_UP_POINTS_PER_SECOND = 10;

const HISTORY_SIZE = 5;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// The AI's speed changes from day to day (about 2x in real logs), so the
// expected stage 1 duration is learned from this browser's own recent runs
// instead of being hardcoded.
const loadExpectedStage1Seconds = (profile) => {
  try {
    const history = JSON.parse(localStorage.getItem(profile.historyKey) || "[]").filter((n) => Number.isFinite(n) && n > 0);
    return history.length ? median(history) : profile.defaultStage1Seconds;
  } catch {
    return profile.defaultStage1Seconds;
  }
};

const rememberStage1Seconds = (profile, seconds) => {
  try {
    const history = JSON.parse(localStorage.getItem(profile.historyKey) || "[]").filter((n) => Number.isFinite(n) && n > 0);
    history.push(seconds);
    localStorage.setItem(profile.historyKey, JSON.stringify(history.slice(-HISTORY_SIZE)));
  } catch {
    // Storage unavailable — the default estimate is used next time instead.
  }
};

// Linear up to 90% of the expected duration, then an ever-slower approach
// toward (never reaching) 100% — so an overrun keeps visibly, honestly
// creeping instead of stalling.
const approach = (value, expected) => {
  const f = Math.max(0, value) / Math.max(0.1, expected);
  return f <= 1 ? 0.9 * f : 0.9 + 0.1 * (1 - Math.exp(-(f - 1) * 2));
};

const lerp = ([from, to], fraction) => from + (to - from) * Math.min(1, Math.max(0, fraction));

// `kind` picks the calibration profile: "drawing" (default) or "email".
export const createExtractionProgress = (kind = "drawing", now = () => Date.now()) => {
  const profile = PROFILES[kind] || PROFILES.drawing;
  let phase = "upload"; // upload | prepare | prepared | stage1 | between | stage2 | finalize | done
  let phaseStartedAt = now();
  let uploadFraction = 0;
  let appliedFraction = 0;
  let outputChunks = 0;
  let outputStarted = false;
  let stage1Expected = loadExpectedStage1Seconds(profile);
  let stage2Expected = stage1Expected * profile.stage2Ratio;
  // True when the backend only offers the original blocking endpoint (an
  // older deployment) — there are no real events to follow, so the UI shows
  // an honest "processing" animation instead of a percentage it can't back up.
  let legacy = false;
  let high = 0;
  let displayed = 0;
  let lastReadAt = now();

  const enter = (next) => {
    phase = next;
    phaseStartedAt = now();
    outputChunks = 0;
    outputStarted = false;
  };

  const stageFraction = (stage, expectedSeconds) => {
    const share = profile.reasoningShare[stage];
    if (outputStarted) {
      // Soft-saturating (see approach) rather than a hard cap: an answer
      // longer than typical keeps creeping instead of parking at one value.
      const written = approach(outputChunks, profile.expectedOutputChunks[stage]) * 0.999;
      return share + (1 - share) * written;
    }
    const elapsed = (now() - phaseStartedAt) / 1000;
    return share * approach(elapsed, expectedSeconds * share) * 0.999;
  };

  const raw = () => {
    switch (phase) {
      case "upload":
        return lerp(PHASES.upload, uploadFraction);
      case "prepare":
        return lerp(PHASES.prepare, approach((now() - phaseStartedAt) / 1000, profile.expectedPrepareSeconds));
      case "prepared":
        return PHASES.prepare[1];
      case "stage1":
        return lerp(PHASES.stage1, stageFraction(1, stage1Expected));
      case "between":
        return PHASES.stage1[1];
      case "stage2":
        return lerp(PHASES.stage2, stageFraction(2, stage2Expected));
      case "finalize":
        return lerp(PHASES.finalize, appliedFraction * 0.99);
      default:
        return 100;
    }
  };

  return {
    handleUploadProgress(loaded, total) {
      if (phase === "upload" && total > 0) uploadFraction = Math.max(uploadFraction, loaded / total);
    },

    handleEvent(event) {
      switch (event.type) {
        case "legacy":
          legacy = true;
          break;
        case "received":
          uploadFraction = 1;
          enter("prepare");
          break;
        case "converted":
          enter("prepared");
          break;
        case "stage":
          if (event.stage === 1 && event.state === "start") enter("stage1");
          if (event.stage === 1 && event.state === "done") {
            if (Number.isFinite(event.seconds) && event.seconds > 0) {
              rememberStage1Seconds(profile, event.seconds);
              stage2Expected = event.seconds * profile.stage2Ratio;
            }
            enter("between");
          }
          if (event.stage === 2 && event.state === "start") enter("stage2");
          if (event.stage === 2 && event.state === "done") enter("finalize");
          break;
        case "tokens":
          if ((phase === "stage1" && event.stage === 1) || (phase === "stage2" && event.stage === 2)) {
            outputStarted = true;
            outputChunks = Math.max(outputChunks, event.count);
          }
          break;
        default:
          break;
      }
    },

    // For a result made of several parts (an email can describe up to 4
    // components, each becoming its own document): the fraction of them
    // already applied, so the last 5% advances part by part instead of
    // sitting still while they're created one after another.
    setApplied(fraction) {
      appliedFraction = Math.min(1, Math.max(appliedFraction, fraction));
    },

    // Called by the UI only once the extracted details have actually been
    // applied — the one and only way the bar reaches 100.
    finish() {
      phase = "done";
    },

    // Current 0-100 value — monotonic, and capped just below 100 until
    // finish() is called. `high` is the true value at this instant;
    // `displayed` glides up to it (see CATCH_UP_POINTS_PER_SECOND).
    percent() {
      if (phase === "done") return 100;
      const current = now();
      const elapsed = Math.max(0, (current - lastReadAt) / 1000);
      lastReadAt = current;
      high = Math.max(high, Math.min(99.5, raw()));
      if (displayed < high) displayed = Math.min(high, displayed + CATCH_UP_POINTS_PER_SECOND * elapsed);
      return displayed;
    },

    // See `legacy` above — the UI shows no percentage while this is true.
    indeterminate() {
      return legacy && phase !== "done";
    },

    // Which label the UI should show for the current phase.
    stage() {
      const suffix = profile.labelSuffix;
      if (legacy && phase !== "done") return "processing";
      if (phase === "upload") return `uploading${suffix}`;
      if (phase === "prepare" || phase === "prepared") return `preparing${suffix}`;
      if (phase === "stage1" || phase === "between") return `stage1${suffix}`;
      if (phase === "stage2") return "stage2";
      if (phase === "finalize") return "finalizing";
      return "done";
    },
  };
};
