import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation, translate } from "../i18n/LanguageContext";
import Stepper from "../components/TestReport/Stepper";
import BasicInformation from "../components/TestReport/BasicInformation/BasicInformation";
import TestConditions from "../components/TestReport/TestConditions/TestConditions";
import Results from "../components/TestReport/Results/Results";
import Evaluation from "../components/TestReport/Evaluation/Evaluation";
import TestReportPreview from "../components/TestReport/PreviewExport/TestReportPreview";
import LoadingBar from "../components/TestReport/LoadingBar";
import { DEFAULT_DELAMINATION_VERFAHREN } from "../components/TestReport/PreviewExport/testReportDocData";
import {
  STEPS,
  CYCLE_DURATIONS,
  getDefaultInspectionRows,
  getEvaluationSeedText,
  getEvaluationTable2SeedRows,
  addDaysIso,
  buildResultSections,
  getInitialReportInfo,
  getInitialSubjectTask,
} from "../components/TestReport/testReportConstants";
import {
  getTestReport,
  createTestReport,
  updateTestReport,
  uploadReportImage,
  deleteReportImageBestEffort,
} from "../components/TestReport/testReportsApi";
import "../components/TestReport/testReport.css";

// This page is a thin orchestrator, matching how Documents.jsx owns state
// and hands it down to focused child components (Calculation, OfferDetails,
// DocPreview, ...) instead of rendering everything inline. All the actual
// state and handlers for the wizard live here; each step's own visual
// pieces live under components/TestReport/ as their own files — see that
// folder's structure for the breakdown (one folder per step, split further
// wherever a step visually has more than one distinct block, e.g. Results'
// rail + content).
//
// `openReportId` mirrors Documents.jsx's own openDocumentId prop — set by
// App.jsx when Test Report Overview's "Open" button is clicked, null when
// starting fresh from the sidebar. `onSaved` is called after a successful
// Save so App.jsx's Overview list (testReportRecords) picks up the change
// without the user having to navigate away and back.
//
// Every photo slot in the wizard uploads straight to Google Cloud Storage
// on selection (see ensureReportId/uploadReportImage below) — no local
// blob: URL is ever created, so a photo is exactly as durable as any other
// field once uploaded: it survives closing and reopening the report. The
// one piece of choreography this requires: a photo can be the very first
// thing a user does after opening a brand-new report, before Save has
// ever been clicked — ensureReportId lazily creates the backend row the
// moment any image actually needs somewhere to upload to, rather than
// requiring an explicit Save first.
const TestReport = ({ openReportId = null, onSaved }) => {
  const { t, language } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);

  // The backend id of the report currently being edited — null until the
  // first image upload or Save (or immediately, if opened from an existing
  // Overview row). Save PATCHes when this is set, POSTs (creating a new
  // row) when it isn't.
  const [reportId, setReportId] = useState(openReportId);
  // Mirrors reportId for code that needs to read it synchronously inside a
  // plain (non-React-state-aware) function body — image handlers below
  // read this to look up "what was in this slot before" without needing
  // the functional setState form.
  const reportIdRef = useRef(reportId);
  useEffect(() => {
    reportIdRef.current = reportId;
  }, [reportId]);
  // Seeded true exactly when openReportId is already set on first render,
  // same reasoning as Documents.jsx's own `hydrating` flag — this
  // component mounts fresh every time (App.jsx renders one page at a
  // time), so without this the loading state would be a beat behind the
  // fetch that's about to start.
  const [loadingReport, setLoadingReport] = useState(Boolean(openReportId));

  // Cross-cut Test (DIN EN ISO 2409) — two independent rail items now, one
  // per test (see buildResultSections), not one shared slot with a
  // dropdown picking which test it belongs to. Each gets its own
  // standalone state, same as before, just duplicated rather than carrying
  // a testAssignment field.
  const [corrosionCrosscutData, setCorrosionCrosscutData] = useState({
    beforeImage: null,
    afterImage: null,
    descriptionBefore: "",
    descriptionAfter: "",
    // The Gt-class result (e.g. "1x Gt0") — feeds this card's own
    // "Gitterschnittprüfung nach der Belastung …" photo caption in Step 5
    // (see testReportDocData.js's buildCaptions).
    grade: "",
  });
  const [condensationCrosscutData, setCondensationCrosscutData] = useState({
    beforeImage: null,
    afterImage: null,
    descriptionBefore: "",
    descriptionAfter: "",
    grade: "",
  });

  // Konstant klimatest — its own rail item too, same standalone-state shape
  // as Cross-cut Test above (minus the test-assignment dropdown, which is
  // specific to Cross-cut Test).
  const [constantClimateData, setConstantClimateData] = useState({
    beforeImage: null,
    afterImage: null,
    descriptionBefore: "",
    descriptionAfter: "",
  });

  // Step 2's "Upload image before testing" reference pair — one for the
  // Corrosion Change Test's One Test Cycle card, a separate independent
  // one for the Condensation Water Constant Climate card (BeforeTesting
  // Uploader renders both, now as a controlled component so these photos
  // are real, saved uploads instead of local-only state that silently
  // forgot itself on reload).
  const [corrosionReferenceImages, setCorrosionReferenceImages] = useState({ beforeImage: null, afterImage: null });
  const [condensationReferenceImages, setCondensationReferenceImages] = useState({ beforeImage: null, afterImage: null });

  // Step 5's manual "resize/align like Word" overrides — a user dragging
  // one photo's corner handle, or picking left/center/right for it, in the
  // document preview. One `{ scale, align }` entry per photo, keyed by the
  // photo's own objectPath (or, before it's ever been saved, its temporary
  // blob: URL — see resolveImage's re-keying below), not by where it sits
  // in the document, so each upload's resize/alignment is independent of
  // everything else. Layout (which photos share a row, side-by-side vs.
  // stacked) is never touched by this — only that one photo's own size and
  // position *within its own cell*.
  const [imageSizeOverrides, setImageSizeOverrides] = useState({});
  const imageSizeOverridesRef = useRef(imageSizeOverrides);
  useEffect(() => {
    imageSizeOverridesRef.current = imageSizeOverrides;
  }, [imageSizeOverrides]);

  // Step 5's editable photo captions — the auto-generated "Abb. N ..."
  // text under each photo box is just a starting point; the user can edit
  // it in place (see TestReportPreview.jsx's photoBox), and that edit is
  // what both the preview and the download show from then on. Keyed by a
  // stable group key (e.g. "cycle-30-delam"), not by image identity —
  // unlike imageSizeOverrides, no re-keying is ever needed on Save, since
  // a group's key never changes when its photos upload/resolve. The "Abb.
  // N" NUMBER itself is never part of this — it's always recomputed fresh
  // from which groups currently exist (see testReportDocData.js), so
  // adding/removing a photo group still renumbers everything after it
  // correctly even if an earlier group's own text was edited.
  const [captionOverrides, setCaptionOverrides] = useState({});
  const setCaptionOverride = (key, text) => setCaptionOverrides((prev) => ({ ...prev, [key]: text }));

  // Step 4 (Evaluation) — one row per cycle checkpoint, auto-kept in sync
  // with Test Duration (Cycles) the same way Results' rail is (seeded for
  // every possible duration up front, filtered to the current one at
  // render time — see the table's own filter below).
  const [evaluationSyncedRows, setEvaluationSyncedRows] = useState(() => {
    const seedText = getEvaluationSeedText(t);
    const rows = {};
    CYCLE_DURATIONS.forEach((cycles) => {
      rows[cycles] = {
        result: seedText[cycles]?.result ?? "",
        requirement: seedText[cycles]?.requirement ?? "",
        assessment: "Fulfilled",
      };
    });
    return rows;
  });
  // One overall write-up for the whole Evaluation step, distinct from each
  // row's own per-cycle Assessment dropdown in the table above.
  const [evaluationSummary, setEvaluationSummary] = useState("");

  // Table 2 (Condensation Water Constant Climate) — fixed reference rows,
  // seeded from the reference design; see the comment above its table in
  // the JSX for why it isn't cycle-driven like Table 1.
  const [table2Rows, setTable2Rows] = useState(() => getEvaluationTable2SeedRows(t));

  // Step 1's seed record — a lazy initializer so it's only ever computed
  // once (in whichever language is active when the wizard first mounts),
  // exactly like every other freeform-editable seed value on this page.
  const [reportInfo, setReportInfo] = useState(() => getInitialReportInfo(t));
  const [subjectTask, setSubjectTask] = useState(() => getInitialSubjectTask(t));

  // Every seed value above (report description/test object, the two
  // initial Tests entries, the Evaluation tables' Result/Requirement seed
  // text) is only ever computed once, in whichever language was active
  // when this component first mounted — plain useState lazy initializers
  // don't re-run just because the app's language toggles afterward. Real,
  // user-typed or AI-extracted content must never be touched by a language
  // switch, but the generic placeholder seed text should — otherwise
  // switching Basic Information/Evaluation's own labels to English while
  // the seeded description/table rows stay frozen in German (or vice
  // versa) reads as broken. Reconciled the same "swap only if still
  // untouched" way the multi-image workspace's own auto-fill safety nets
  // already do: recompute what each field's seed text WOULD have been in
  // the previous language, and only replace a field that still exactly
  // matches that — anything the user (or AI extraction) actually changed
  // is left alone, in either language, forever.
  const prevLanguageRef = useRef(language);
  useEffect(() => {
    const prevLang = prevLanguageRef.current;
    prevLanguageRef.current = language;
    if (prevLang === language) return;
    const tOld = (key, vars) => translate(prevLang, key, vars);
    const tNew = (key, vars) => translate(language, key, vars);

    const oldInfo = getInitialReportInfo(tOld);
    const newInfo = getInitialReportInfo(tNew);
    setReportInfo((prev) => ({
      ...prev,
      description: prev.description === oldInfo.description ? newInfo.description : prev.description,
      testObjectPart: prev.testObjectPart === oldInfo.testObjectPart ? newInfo.testObjectPart : prev.testObjectPart,
    }));

    const oldSubject = getInitialSubjectTask(tOld);
    const newSubject = getInitialSubjectTask(tNew);
    setSubjectTask((prev) => ({
      ...prev,
      tests: prev.tests.map((value, i) => (value === oldSubject.tests[i] ? newSubject.tests[i] ?? value : value)),
      createdBy: prev.createdBy === oldSubject.createdBy ? newSubject.createdBy : prev.createdBy,
    }));

    const oldEvalSeed = getEvaluationSeedText(tOld);
    const newEvalSeed = getEvaluationSeedText(tNew);
    setEvaluationSyncedRows((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((cycles) => {
        const oldSeed = oldEvalSeed[cycles];
        const newSeed = newEvalSeed[cycles];
        if (!oldSeed || !newSeed) return;
        const row = next[cycles];
        next[cycles] = {
          ...row,
          result: row.result === oldSeed.result ? newSeed.result : row.result,
          requirement: row.requirement === oldSeed.requirement ? newSeed.requirement : row.requirement,
        };
      });
      return next;
    });

    const oldTable2Seed = getEvaluationTable2SeedRows(tOld);
    const newTable2Seed = getEvaluationTable2SeedRows(tNew);
    setTable2Rows((prev) =>
      prev.map((row) => {
        const oldSeed = oldTable2Seed.find((r) => r.id === row.id);
        const newSeed = newTable2Seed.find((r) => r.id === row.id);
        if (!oldSeed || !newSeed) return row;
        return {
          ...row,
          result: row.result === oldSeed.result ? newSeed.result : row.result,
          requirement: row.requirement === oldSeed.requirement ? newSeed.requirement : row.requirement,
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Step 2's Condensation Water Constant Climate card — Beginn/Ende are
  // typed by the user, not purely derived, so they get their own state
  // seeded from Test Start Date (+10 days for Ende, 240 h) as a starting
  // point rather than being recomputed from it on every render.
  const [cwtBegin, setCwtBegin] = useState(() => reportInfo.testStartDate);
  const [cwtEnd, setCwtEnd] = useState(() => addDaysIso(reportInfo.testStartDate, 10));
  const [evaluationSummary2, setEvaluationSummary2] = useState("");

  // Test Method defaults to the first test picked in Step 1's Tests list —
  // editable here too, since a report can run more test methods than were
  // originally listed. Test Duration (Cycles) has no Step 1 counterpart, so
  // it just starts blank-ish at a sensible default.
  const [testMethod, setTestMethod] = useState(() => subjectTask.tests[0] ?? "");
  const [durationCycles, setDurationCycles] = useState("60");
  // Condensation Water Constant Climate's own duration — a real dropdown
  // choice (see CONDENSATION_DURATION_OPTIONS), independent of
  // durationCycles above (a cycle *count*, not an hour count, and shared
  // with the corrosion test's own Results rail regardless of which test
  // method happens to be selected here).
  const [condensationDuration, setCondensationDuration] = useState("240 h");

  const [resultsSection, setResultsSection] = useState("cycles5");
  // Seeded for every possible checkpoint (5/15/30/60/120/240), not just the
  // ones the current Test Duration (Cycles) shows — the rail only shows a
  // subset (see buildResultSections), but raising the duration back up
  // later must not have lost whatever was already filled in for a
  // checkpoint that was temporarily hidden.
  const [cyclesData, setCyclesData] = useState(() => {
    const data = {};
    CYCLE_DURATIONS.forEach((cycles) => {
      data[`cycles${cycles}`] = {
        rows: getDefaultInspectionRows(t),
        beforeImage: null,
        afterImage: null,
        // The ISO 4628-8 scratch-delamination follow-up test — only ever
        // shown (see the "some row isn't Pass" check below) once an
        // inspection row actually needs it, but the data lives here from
        // the start so switching cycle sections never loses what was
        // already filled in. Only applies to "in between" cycle
        // checkpoints (i.e. every cycle EXCEPT the last one at the current
        // Test Duration) — the last checkpoint uses finalDelamination
        // below instead, regardless of Pass/Fail.
        delamination: { verfahren: DEFAULT_DELAMINATION_VERFAHREN, beforeImage: null, afterImage: null, dBefore: "", dAfter: "" },
        // Same ISO 4628-8 test, but for the LAST cycle checkpoint only —
        // never auto-triggered by a Fail/Conditional row, shown instead by
        // an explicit "Add Delamination Measurement" button. This version
        // is a repeatable log, not a single fixed set of fields: "+ Add"
        // snapshots whatever's currently filled in (procedure, both
        // images, both D values, both cycle numbers) as one entry in
        // `entries`, then clears the working fields for the next one —
        // e.g. one entry logged at cycle 30, another at the true final 60.
        finalDelamination: {
          revealed: false,
          open: true,
          procedure: DEFAULT_DELAMINATION_VERFAHREN,
          beforeImage: null,
          afterImage: null,
          dBefore: "",
          cycleBefore: "",
          dAfter: "",
          cycleAfter: "",
          entries: [],
        },
      };
    });
    return data;
  });
  // Mirrors each image-holding state so the upload handlers below (plain
  // async functions, not React-state-aware) can read "what was in this
  // slot before" synchronously — e.g. to delete the old GCS object on a
  // replace — without needing the functional setState form for a read.
  const cyclesDataRef = useRef(cyclesData);
  useEffect(() => {
    cyclesDataRef.current = cyclesData;
  }, [cyclesData]);
  const corrosionCrosscutDataRef = useRef(corrosionCrosscutData);
  useEffect(() => {
    corrosionCrosscutDataRef.current = corrosionCrosscutData;
  }, [corrosionCrosscutData]);
  const condensationCrosscutDataRef = useRef(condensationCrosscutData);
  useEffect(() => {
    condensationCrosscutDataRef.current = condensationCrosscutData;
  }, [condensationCrosscutData]);
  const constantClimateDataRef = useRef(constantClimateData);
  useEffect(() => {
    constantClimateDataRef.current = constantClimateData;
  }, [constantClimateData]);
  const corrosionReferenceImagesRef = useRef(corrosionReferenceImages);
  useEffect(() => {
    corrosionReferenceImagesRef.current = corrosionReferenceImages;
  }, [corrosionReferenceImages]);
  const condensationReferenceImagesRef = useRef(condensationReferenceImages);
  useEffect(() => {
    condensationReferenceImagesRef.current = condensationReferenceImages;
  }, [condensationReferenceImages]);
  const subjectTaskRef = useRef(subjectTask);
  useEffect(() => {
    subjectTaskRef.current = subjectTask;
  }, [subjectTask]);

  // Photos are held locally (a blob: URL for instant preview) from the
  // moment they're picked and only uploaded to Cloud Storage when Save is
  // clicked — see uploadPendingImages below. Two consequences of that
  // deferral, both handled here rather than eagerly in the image handlers:
  //   - object paths of ALREADY-uploaded photos that got replaced/removed
  //     since the last Save can't be deleted from the bucket immediately
  //     (the saved report still references them until this Save actually
  //     lands) — they queue here and are deleted only after updateTestReport
  //     succeeds.
  //   - blob: URLs for pending photos are revoked as they're superseded
  //     (in the handlers) and on unmount (the effect at the bottom).
  const pendingDeletionsRef = useRef([]);

  // Lowering Test Duration (Cycles) can hide the rail item currently being
  // viewed (e.g. looking at 60 Cycles, then the duration drops to 15) —
  // that checkpoint's data is kept (see cyclesData's seeding above, it
  // isn't deleted), but the rail selection itself falls back to Overview
  // rather than pointing at something no longer shown.
  useEffect(() => {
    const validIds = buildResultSections(durationCycles, t, subjectTask).map((section) => section.id);
    if (!validIds.includes(resultsSection)) {
      setResultsSection("overview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationCycles, resultsSection]);

  // Loads an existing report's wizardState into every piece of state above
  // — mirrors Documents.jsx's own "Open in Workspace" hydration effect
  // (same cancelled-flag guard against a stale response landing after a
  // newer openReportId has already superseded it). Every setter is only
  // called when the loaded state actually has that key, so an older or
  // partially-saved record can never wipe a field back to blank/default —
  // it just leaves that one field at whatever the fresh-mount default was.
  useEffect(() => {
    if (!openReportId) return undefined;

    setLoadingReport(true);
    let cancelled = false;
    (async () => {
      try {
        const report = await getTestReport(openReportId);
        if (cancelled) return;
        const w = report.wizardState || {};

        setReportId(report.id);
        if (w.activeStep !== undefined) setActiveStep(w.activeStep);
        if (w.reportInfo !== undefined) setReportInfo((prev) => ({ ...prev, ...w.reportInfo }));
        if (w.subjectTask !== undefined) setSubjectTask((prev) => ({ ...prev, ...w.subjectTask }));
        if (w.testMethod !== undefined) setTestMethod(w.testMethod);
        if (w.durationCycles !== undefined) setDurationCycles(w.durationCycles);
        if (w.condensationDuration !== undefined) setCondensationDuration(w.condensationDuration);
        if (w.cwtBegin !== undefined) setCwtBegin(w.cwtBegin);
        if (w.cwtEnd !== undefined) setCwtEnd(w.cwtEnd);
        if (w.resultsSection !== undefined) setResultsSection(w.resultsSection);
        if (w.cyclesData !== undefined) setCyclesData(w.cyclesData);
        if (w.corrosionCrosscutData !== undefined) setCorrosionCrosscutData(w.corrosionCrosscutData);
        if (w.condensationCrosscutData !== undefined) setCondensationCrosscutData(w.condensationCrosscutData);
        if (w.constantClimateData !== undefined) setConstantClimateData(w.constantClimateData);
        if (w.corrosionReferenceImages !== undefined) setCorrosionReferenceImages(w.corrosionReferenceImages);
        if (w.condensationReferenceImages !== undefined) setCondensationReferenceImages(w.condensationReferenceImages);
        if (w.imageSizeOverrides !== undefined) setImageSizeOverrides(w.imageSizeOverrides);
        if (w.captionOverrides !== undefined) setCaptionOverrides(w.captionOverrides);
        if (w.evaluationSyncedRows !== undefined) setEvaluationSyncedRows(w.evaluationSyncedRows);
        if (w.evaluationSummary !== undefined) setEvaluationSummary(w.evaluationSummary);
        if (w.table2Rows !== undefined) setTable2Rows(w.table2Rows);
        if (w.evaluationSummary2 !== undefined) setEvaluationSummary2(w.evaluationSummary2);
      } catch {
        // Backend not running, or the report was deleted elsewhere between
        // Overview loading its list and this click — the wizard just stays
        // on its fresh-mount defaults rather than getting stuck loading.
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openReportId]);

  // One full snapshot of every editable piece of state — the save-button's
  // payload, and (once opened again) hydration's own source shape above.
  // Deliberately a plain object literal, not trimmed to "only what
  // changed": Save always writes the whole form, same convention
  // Calculation's own Save (documents_repo.update_document) already
  // follows for its own JSONB blob.
  // Any image slot still holding a pending (blob:, not-yet-uploaded) photo
  // is persisted as null — as far as the saved record is concerned it's
  // empty until the upload actually lands (see uploadPendingImages). One
  // recursive pass over the whole built object rather than a null check at
  // every one of the ~20 image sites.
  const nullifyPending = (value) => {
    if (Array.isArray(value)) return value.map(nullifyPending);
    if (value && typeof value === "object") {
      if (value.pending) return null;
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = nullifyPending(v);
      return out;
    }
    return value;
  };

  // `overrides` lets handleSave pass the freshly-resolved (post-upload)
  // image structures straight through, since the corresponding setState
  // calls it just fired won't have flushed to the state variables this
  // closure reads yet.
  const buildWizardState = (overrides = {}) =>
    nullifyPending({
      activeStep,
      reportInfo,
      subjectTask: overrides.subjectTask ?? subjectTask,
      testMethod,
      durationCycles,
      condensationDuration,
      cwtBegin,
      cwtEnd,
      resultsSection,
      cyclesData: overrides.cyclesData ?? cyclesData,
      corrosionCrosscutData: overrides.corrosionCrosscutData ?? corrosionCrosscutData,
      condensationCrosscutData: overrides.condensationCrosscutData ?? condensationCrosscutData,
      constantClimateData: overrides.constantClimateData ?? constantClimateData,
      corrosionReferenceImages: overrides.corrosionReferenceImages ?? corrosionReferenceImages,
      condensationReferenceImages: overrides.condensationReferenceImages ?? condensationReferenceImages,
      imageSizeOverrides: overrides.imageSizeOverrides ?? imageSizeOverrides,
      captionOverrides,
      evaluationSyncedRows,
      evaluationSummary,
      table2Rows,
      evaluationSummary2,
    });

  // One pending photo -> uploaded {objectPath, name, url}; anything else
  // (already uploaded, or null) passes through untouched.
  const resolveImage = async (id, image) => {
    if (image?.pending && image.file) {
      const uploaded = await uploadReportImage(id, image.slot, image.file);
      URL.revokeObjectURL(image.url);
      // A resize/alignment override made while this photo was still a
      // local, unsaved blob: URL is keyed to that URL — which stops
      // existing the moment it's revoked above — so carry it over to the
      // photo's new, permanent objectPath key rather than losing it on the
      // very first Save.
      const oldKey = image.url;
      setImageSizeOverrides((prev) => {
        if (!(oldKey in prev)) return prev;
        const { [oldKey]: override, ...rest } = prev;
        return { ...rest, [uploaded.objectPath]: override };
      });
      return uploaded;
    }
    return image;
  };

  const resolvePair = async (id, obj) => ({
    ...obj,
    beforeImage: await resolveImage(id, obj.beforeImage),
    afterImage: await resolveImage(id, obj.afterImage),
  });

  // Walks every image-holding slice, uploads whatever's still pending,
  // applies the resulting setState calls, and returns the resolved
  // structures for buildWizardState to serialize from.
  const uploadPendingImages = async (id) => {
    const cd = cyclesDataRef.current;
    const resolvedCycles = {};
    for (const [sectionId, section] of Object.entries(cd)) {
      resolvedCycles[sectionId] = {
        ...section,
        beforeImage: await resolveImage(id, section.beforeImage),
        afterImage: await resolveImage(id, section.afterImage),
        delamination: {
          ...section.delamination,
          beforeImage: await resolveImage(id, section.delamination.beforeImage),
          afterImage: await resolveImage(id, section.delamination.afterImage),
        },
        finalDelamination: {
          ...section.finalDelamination,
          beforeImage: await resolveImage(id, section.finalDelamination.beforeImage),
          afterImage: await resolveImage(id, section.finalDelamination.afterImage),
          entries: await Promise.all(
            section.finalDelamination.entries.map(async (entry) => ({
              ...entry,
              beforeImage: await resolveImage(id, entry.beforeImage),
              afterImage: await resolveImage(id, entry.afterImage),
            }))
          ),
        },
      };
    }
    setCyclesData(resolvedCycles);

    const resolvedCorrosionCrosscut = await resolvePair(id, corrosionCrosscutDataRef.current);
    setCorrosionCrosscutData(resolvedCorrosionCrosscut);
    const resolvedCondensationCrosscut = await resolvePair(id, condensationCrosscutDataRef.current);
    setCondensationCrosscutData(resolvedCondensationCrosscut);
    const resolvedConstantClimate = await resolvePair(id, constantClimateDataRef.current);
    setConstantClimateData(resolvedConstantClimate);
    const resolvedCorrosionRef = await resolvePair(id, corrosionReferenceImagesRef.current);
    setCorrosionReferenceImages(resolvedCorrosionRef);
    const resolvedCondensationRef = await resolvePair(id, condensationReferenceImagesRef.current);
    setCondensationReferenceImages(resolvedCondensationRef);

    const resolvedSubjectTask = {
      ...subjectTaskRef.current,
      signature: await resolveImage(id, subjectTaskRef.current.signature),
    };
    setSubjectTask(resolvedSubjectTask);

    return {
      cyclesData: resolvedCycles,
      corrosionCrosscutData: resolvedCorrosionCrosscut,
      condensationCrosscutData: resolvedCondensationCrosscut,
      constantClimateData: resolvedConstantClimate,
      corrosionReferenceImages: resolvedCorrosionRef,
      condensationReferenceImages: resolvedCondensationRef,
      subjectTask: resolvedSubjectTask,
      // Read via the ref, not the state variable directly — every
      // resolveImage() call above may have just re-keyed an override from
      // a pending blob: URL to its real objectPath, and this closure's own
      // `imageSizeOverrides` won't reflect those updates yet.
      imageSizeOverrides: imageSizeOverridesRef.current,
    };
  };

  // The Save button — creates the backend row if this is a brand-new
  // report, uploads every pending photo, saves the whole form, then (only
  // after the save lands) deletes any GCS objects that were replaced or
  // removed since the last Save.
  const handleSave = async () => {
    // No try/catch here — a rejection just propagates to the caller as-is.
    // Step 5's Save button is a ProgressButton (see TestReportPreview.jsx)
    // that detects failure from this promise actually rejecting, so its
    // progress fill shows the error state instead of reading as success.
    const id = await ensureReportId();
    const resolved = await uploadPendingImages(id);
    const payload = {
      reportNo: reportInfo.reportNo || "",
      testObject: reportInfo.testObjectPart || "",
      norm: subjectTask.surfaceProtectionType || "",
      testDate: reportInfo.testStartDate || null,
      wizardState: buildWizardState(resolved),
      // Overview's status pill: a report starts "pending" the moment its
      // draft row is created (ensureReportId, e.g. from "Test required"
      // or the very first photo) and only flips to "created" once Save
      // actually succeeds here.
      status: "created",
    };
    const saved = await updateTestReport(id, payload);
    setReportId(saved.id);

    const toDelete = pendingDeletionsRef.current;
    pendingDeletionsRef.current = [];
    toDelete.forEach((objectPath) => deleteReportImageBestEffort(id, { objectPath }));

    onSaved?.();
  };

  // Creates the backend row for a brand-new report (started from the
  // sidebar, not from Document Preview's "Test required" which creates its
  // own). Only ever called from handleSave now — image handlers no longer
  // upload on select, so nothing needs a report id before Save.
  const ensureReportIdPromiseRef = useRef(null);
  const ensureReportId = () => {
    if (reportId) return Promise.resolve(reportId);
    if (!ensureReportIdPromiseRef.current) {
      ensureReportIdPromiseRef.current = createTestReport({
        reportNo: reportInfo.reportNo || "",
        testObject: reportInfo.testObjectPart || "",
        norm: subjectTask.surfaceProtectionType || "",
        testDate: reportInfo.testStartDate || null,
        wizardState: buildWizardState(),
      }).then((created) => {
        reportIdRef.current = created.id;
        setReportId(created.id);
        onSaved?.();
        return created.id;
      });
    }
    return ensureReportIdPromiseRef.current;
  };

  const setReportField = (field) => (event) =>
    setReportInfo((prev) => ({ ...prev, [field]: event.target.value }));

  const setSubjectField = (field) => (event) =>
    setSubjectTask((prev) => ({ ...prev, [field]: event.target.value }));

  // Material is a fixed CustomSelect again (not a free-text datalist
  // combobox like Created By) — a native <input list> dropdown can't be
  // reliably reopened once its value already matches an option in some
  // browsers, and the field only ever needs exactly the 3 fixed choices
  // now anyway, not a "type your own" escape hatch.
  const setSubjectSelect = (field) => (value) => setSubjectTask((prev) => ({ ...prev, [field]: value }));

  // Shared "photo slot changed" logic for every image handler below.
  // `previous` is whatever was in the slot, `slot` the upload key to stamp
  // on the new pending image. Nothing uploads here — `file` becomes a
  // blob-backed pending object shown immediately; the real upload happens
  // on Save (uploadPendingImages). A superseded pending photo has its blob
  // revoked now; a superseded already-uploaded one is queued for deletion
  // after the next Save actually lands.
  const nextImageValue = (previous, slot, file) => {
    if (previous?.pending && previous.url) URL.revokeObjectURL(previous.url);
    if (previous?.objectPath) pendingDeletionsRef.current.push(previous.objectPath);
    return file
      ? { file, url: URL.createObjectURL(file), name: file.name, pending: true, slot }
      : null;
  };

  // Bearbeiter's signature image — never previewed in the form, otherwise
  // the same "pick now, upload on Save" flow as every photo slot.
  const setSignatureImage = (file) =>
    setSubjectTask((prev) => ({ ...prev, signature: nextImageValue(prev.signature, "signature", file) }));

  const setTestValue = (index, value) =>
    setSubjectTask((prev) => ({
      ...prev,
      tests: prev.tests.map((test, i) => (i === index ? value : test)),
    }));

  const addTest = () => setSubjectTask((prev) => ({ ...prev, tests: [...prev.tests, ""] }));

  const removeTest = (index) =>
    setSubjectTask((prev) => ({
      ...prev,
      tests: prev.tests.length > 1 ? prev.tests.filter((_, i) => i !== index) : prev.tests,
    }));

  const updateCycleRow = (sectionId, rowIndex, field) => (valueOrEvent) => {
    const value = typeof valueOrEvent === "string" ? valueOrEvent : valueOrEvent.target.value;
    setCyclesData((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        rows: prev[sectionId].rows.map((row, i) => (i === rowIndex ? { ...row, [field]: value } : row)),
      },
    }));
  };

  // Before/After photos, per cycle checkpoint. `slot` is "beforeImage" or
  // "afterImage" — the pending image is stamped with a key encoding which
  // checkpoint and side it belongs to (e.g. "cycles30.beforeImage") for
  // the eventual upload on Save.
  const setCycleImage = (sectionId, slot, file) =>
    setCyclesData((prev) => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], [slot]: nextImageValue(prev[sectionId][slot], `${sectionId}.${slot}`, file) },
    }));

  const swapCycleImages = (sectionId) => {
    setCyclesData((prev) => {
      const current = prev[sectionId];
      return { ...prev, [sectionId]: { ...current, beforeImage: current.afterImage, afterImage: current.beforeImage } };
    });
  };

  // Same shape as setCycleImage/swapCycleImages above, one level deeper —
  // these operate on cyclesData[sectionId].delamination instead of the
  // section itself.
  const setDelaminationField = (sectionId, field) => (value) =>
    setCyclesData((prev) => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], delamination: { ...prev[sectionId].delamination, [field]: value } },
    }));

  const setDelaminationImage = (sectionId, slot, file) =>
    setCyclesData((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        delamination: {
          ...prev[sectionId].delamination,
          [slot]: nextImageValue(prev[sectionId].delamination[slot], `${sectionId}.delamination.${slot}`, file),
        },
      },
    }));

  const swapDelaminationImages = (sectionId) => {
    setCyclesData((prev) => {
      const current = prev[sectionId].delamination;
      return {
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          delamination: { ...current, beforeImage: current.afterImage, afterImage: current.beforeImage },
        },
      };
    });
  };

  // Same pattern again, one more level deep, for finalDelamination (the
  // LAST cycle checkpoint's button-revealed version of this same test).
  const revealFinalDelamination = (sectionId) =>
    setCyclesData((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        finalDelamination: { ...prev[sectionId].finalDelamination, revealed: true },
      },
    }));

  const toggleFinalDelaminationOpen = (sectionId) =>
    setCyclesData((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        finalDelamination: { ...prev[sectionId].finalDelamination, open: !prev[sectionId].finalDelamination.open },
      },
    }));

  // Closes the card back to the "Add Delamination Measurement" button —
  // distinct from the collapse chevron, which only hides the body while
  // the card itself stays put. Nothing already filled in (working fields
  // or logged entries) is cleared, only `revealed` flips back off, so
  // clicking the button again picks up exactly where it left off.
  const closeFinalDelamination = (sectionId) =>
    setCyclesData((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        finalDelamination: { ...prev[sectionId].finalDelamination, revealed: false },
      },
    }));

  const setFinalDelaminationField = (sectionId, field) => (value) =>
    setCyclesData((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        finalDelamination: { ...prev[sectionId].finalDelamination, [field]: value },
      },
    }));

  const setFinalDelaminationImage = (sectionId, slot, file) =>
    setCyclesData((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        finalDelamination: {
          ...prev[sectionId].finalDelamination,
          [slot]: nextImageValue(
            prev[sectionId].finalDelamination[slot],
            `${sectionId}.finalDelamination.${slot}`,
            file
          ),
        },
      },
    }));

  // Swaps the whole before/after "side" — image, D value, and cycle number
  // together — since Before/After each now carry their own cycle number
  // (the photo and its D reading might have been taken at different
  // checkpoints), not just the image.
  const swapFinalDelaminationImages = (sectionId) => {
    setCyclesData((prev) => {
      const current = prev[sectionId].finalDelamination;
      return {
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          finalDelamination: {
            ...current,
            beforeImage: current.afterImage,
            afterImage: current.beforeImage,
            dBefore: current.dAfter,
            dAfter: current.dBefore,
            cycleBefore: current.cycleAfter,
            cycleAfter: current.cycleBefore,
          },
        },
      };
    });
  };

  // "+ Add" snapshots the whole working fieldset — Procedure, both images,
  // both D values, both cycle numbers — as one entry, then clears the
  // working fields for the next one. The entry takes ownership of the
  // image object URLs (they're moved, not duplicated or revoked here);
  // removeFinalDelaminationEntry is what eventually revokes them. No-ops
  // if every field is still empty, rather than adding a blank entry.
  const addFinalDelaminationEntry = (sectionId) => {
    setCyclesData((prev) => {
      const current = prev[sectionId].finalDelamination;
      const hasContent =
        current.procedure ||
        current.beforeImage ||
        current.afterImage ||
        current.dBefore.trim() ||
        current.cycleBefore.trim() ||
        current.dAfter.trim() ||
        current.cycleAfter.trim();
      if (!hasContent) return prev;

      const entry = {
        id: `${Date.now()}-${Math.random()}`,
        procedure: current.procedure,
        beforeImage: current.beforeImage,
        afterImage: current.afterImage,
        dBefore: current.dBefore,
        cycleBefore: current.cycleBefore,
        dAfter: current.dAfter,
        cycleAfter: current.cycleAfter,
      };
      return {
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          finalDelamination: {
            ...current,
            entries: [...current.entries, entry],
            procedure: "",
            beforeImage: null,
            afterImage: null,
            dBefore: "",
            cycleBefore: "",
            dAfter: "",
            cycleAfter: "",
          },
        },
      };
    });
  };

  const removeFinalDelaminationEntry = (sectionId, entryId) =>
    setCyclesData((prev) => {
      const current = prev[sectionId].finalDelamination;
      const entry = current.entries.find((e) => e.id === entryId);
      [entry?.beforeImage, entry?.afterImage].forEach((img) => {
        if (img?.pending && img.url) URL.revokeObjectURL(img.url);
        if (img?.objectPath) pendingDeletionsRef.current.push(img.objectPath);
      });
      return {
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          finalDelamination: { ...current, entries: current.entries.filter((e) => e.id !== entryId) },
        },
      };
    });

  // Cross-cut Test — two independent instances (see buildResultSections),
  // same set/swap pattern as everywhere else on this page, just duplicated
  // against each standalone state instead of a single shared one.
  const setCorrosionCrosscutImage = (slot, file) =>
    setCorrosionCrosscutData((prev) => ({ ...prev, [slot]: nextImageValue(prev[slot], `crosscutCorrosion.${slot}`, file) }));

  // Swaps each image together with its own description, same "swap the
  // whole side" rule the final delamination card's swap already follows.
  const swapCorrosionCrosscutImages = () =>
    setCorrosionCrosscutData((prev) => ({
      ...prev,
      beforeImage: prev.afterImage,
      afterImage: prev.beforeImage,
      descriptionBefore: prev.descriptionAfter,
      descriptionAfter: prev.descriptionBefore,
    }));

  const setCorrosionCrosscutField = (field) => (value) =>
    setCorrosionCrosscutData((prev) => ({ ...prev, [field]: value }));

  const setCondensationCrosscutImage = (slot, file) =>
    setCondensationCrosscutData((prev) => ({
      ...prev,
      [slot]: nextImageValue(prev[slot], `crosscutCondensation.${slot}`, file),
    }));

  const swapCondensationCrosscutImages = () =>
    setCondensationCrosscutData((prev) => ({
      ...prev,
      beforeImage: prev.afterImage,
      afterImage: prev.beforeImage,
      descriptionBefore: prev.descriptionAfter,
      descriptionAfter: prev.descriptionBefore,
    }));

  const setCondensationCrosscutField = (field) => (value) =>
    setCondensationCrosscutData((prev) => ({ ...prev, [field]: value }));

  // Konstant klimatest — identical set/swap/field pattern to Cross-cut Test
  // above, just against its own standalone constantClimateData state.
  const setConstantClimateImage = (slot, file) =>
    setConstantClimateData((prev) => ({ ...prev, [slot]: nextImageValue(prev[slot], `constantClimate.${slot}`, file) }));

  const swapConstantClimateImages = () =>
    setConstantClimateData((prev) => ({
      ...prev,
      beforeImage: prev.afterImage,
      afterImage: prev.beforeImage,
      descriptionBefore: prev.descriptionAfter,
      descriptionAfter: prev.descriptionBefore,
    }));

  const setConstantClimateField = (field) => (value) => setConstantClimateData((prev) => ({ ...prev, [field]: value }));

  // Step 2's "Upload image before testing" reference pairs (BeforeTesting
  // Uploader, now controlled) — same set/swap pattern as everywhere else,
  // just against these two standalone states instead of cyclesData/
  // crosscutData.
  const setCorrosionReferenceImage = (slot, file) =>
    setCorrosionReferenceImages((prev) => ({
      ...prev,
      [slot]: nextImageValue(prev[slot], `corrosionReference.${slot}`, file),
    }));

  const swapCorrosionReferenceImages = () =>
    setCorrosionReferenceImages((prev) => ({ beforeImage: prev.afterImage, afterImage: prev.beforeImage }));

  const setCondensationReferenceImage = (slot, file) =>
    setCondensationReferenceImages((prev) => ({
      ...prev,
      [slot]: nextImageValue(prev[slot], `condensationReference.${slot}`, file),
    }));

  const swapCondensationReferenceImages = () =>
    setCondensationReferenceImages((prev) => ({ beforeImage: prev.afterImage, afterImage: prev.beforeImage }));

  // Step 5's per-photo "resize/align like Word" controls — one override
  // object per photo, `{ scale, align }`, either field independently
  // present or absent. `patch` merges into whichever fields it names;
  // passing `null` for a field clears just that field back to automatic
  // (the resize handle's double-click-to-reset passes `{ scale: null }`,
  // clicking "left" — the unset default — passes `{ align: null }`). The
  // whole per-photo entry is dropped once every field in it is cleared, so
  // a fully-reset photo leaves no trace in the saved wizard state.
  const setImageOverride = (key, patch) =>
    setImageSizeOverrides((prev) => {
      const merged = { ...prev[key], ...patch };
      Object.keys(merged).forEach((field) => {
        if (merged[field] == null) delete merged[field];
      });
      const { [key]: _removed, ...rest } = prev;
      return Object.keys(merged).length ? { ...rest, [key]: merged } : rest;
    });

  // Evaluation table — one row per cycle checkpoint, keyed by cycle count.
  const updateEvaluationSyncedRow = (cycles, field, value) =>
    setEvaluationSyncedRows((prev) => ({ ...prev, [cycles]: { ...prev[cycles], [field]: value } }));

  const updateTable2Row = (id, field, value) =>
    setTable2Rows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));

  // Pending photos hold a blob: URL for their instant preview; if the page
  // unmounts before Save uploads them, those URLs would pin each file's
  // bytes in memory for the tab's whole life. One recursive sweep over
  // every image-holding ref on unmount revokes whatever's still pending.
  useEffect(() => {
    return () => {
      const revokePending = (value) => {
        if (Array.isArray(value)) {
          value.forEach(revokePending);
        } else if (value && typeof value === "object") {
          if (value.pending && typeof value.url === "string") {
            URL.revokeObjectURL(value.url);
          } else {
            Object.values(value).forEach(revokePending);
          }
        }
      };
      revokePending([
        cyclesDataRef.current,
        corrosionCrosscutDataRef.current,
        condensationCrosscutDataRef.current,
        constantClimateDataRef.current,
        corrosionReferenceImagesRef.current,
        condensationReferenceImagesRef.current,
        subjectTaskRef.current,
      ]);
    };
  }, []);

  const goBack = () => setActiveStep((step) => Math.max(0, step - 1));
  const goNext = () => setActiveStep((step) => Math.min(STEPS.length - 1, step + 1));

  // Avoids a flash of fresh-mount default content before the hydration
  // effect above has had a chance to apply the real saved state — same
  // reasoning as Documents.jsx seeding its own `hydrating` flag from the
  // id prop directly rather than starting at false.
  if (loadingReport) {
    return (
      <main className="testreport-page">
        <h1 className="testreport-page-title">{t("testReport.pageTitle")}</h1>
        <div className="testreport-loading">
          <p className="testreport-loading-text">{t("testReport.loadingReport")}</p>
          <LoadingBar />
        </div>
      </main>
    );
  }

  return (
    <main className="testreport-page">
      <h1 className="testreport-page-title">{t("testReport.pageTitle")}</h1>

      <Stepper activeStep={activeStep} onSelectStep={setActiveStep} />

      {activeStep === 0 && (
        <BasicInformation
          reportInfo={reportInfo}
          setReportField={setReportField}
          subjectTask={subjectTask}
          setSubjectField={setSubjectField}
          setSubjectSelect={setSubjectSelect}
          setTestValue={setTestValue}
          addTest={addTest}
          removeTest={removeTest}
          setSignatureImage={setSignatureImage}
        />
      )}

      {activeStep === 1 && (
        <TestConditions
          testMethod={testMethod}
          setTestMethod={setTestMethod}
          subjectTask={subjectTask}
          durationCycles={durationCycles}
          setDurationCycles={setDurationCycles}
          condensationDuration={condensationDuration}
          setCondensationDuration={setCondensationDuration}
          reportInfo={reportInfo}
          cwtBegin={cwtBegin}
          setCwtBegin={setCwtBegin}
          cwtEnd={cwtEnd}
          setCwtEnd={setCwtEnd}
          corrosionReferenceImages={corrosionReferenceImages}
          setCorrosionReferenceImage={setCorrosionReferenceImage}
          swapCorrosionReferenceImages={swapCorrosionReferenceImages}
          condensationReferenceImages={condensationReferenceImages}
          setCondensationReferenceImage={setCondensationReferenceImage}
          swapCondensationReferenceImages={swapCondensationReferenceImages}
        />
      )}

      {activeStep === 2 && (
        <Results
          durationCycles={durationCycles}
          subjectTask={subjectTask}
          reportInfo={reportInfo}
          evaluationSyncedRows={evaluationSyncedRows}
          resultsSection={resultsSection}
          setResultsSection={setResultsSection}
          cyclesData={cyclesData}
          updateCycleRow={updateCycleRow}
          setCycleImage={setCycleImage}
          swapCycleImages={swapCycleImages}
          setDelaminationField={setDelaminationField}
          setDelaminationImage={setDelaminationImage}
          swapDelaminationImages={swapDelaminationImages}
          revealFinalDelamination={revealFinalDelamination}
          toggleFinalDelaminationOpen={toggleFinalDelaminationOpen}
          closeFinalDelamination={closeFinalDelamination}
          setFinalDelaminationField={setFinalDelaminationField}
          setFinalDelaminationImage={setFinalDelaminationImage}
          swapFinalDelaminationImages={swapFinalDelaminationImages}
          addFinalDelaminationEntry={addFinalDelaminationEntry}
          removeFinalDelaminationEntry={removeFinalDelaminationEntry}
          corrosionCrosscutData={corrosionCrosscutData}
          setCorrosionCrosscutImage={setCorrosionCrosscutImage}
          swapCorrosionCrosscutImages={swapCorrosionCrosscutImages}
          setCorrosionCrosscutField={setCorrosionCrosscutField}
          condensationCrosscutData={condensationCrosscutData}
          setCondensationCrosscutImage={setCondensationCrosscutImage}
          swapCondensationCrosscutImages={swapCondensationCrosscutImages}
          setCondensationCrosscutField={setCondensationCrosscutField}
          constantClimateData={constantClimateData}
          setConstantClimateImage={setConstantClimateImage}
          swapConstantClimateImages={swapConstantClimateImages}
          setConstantClimateField={setConstantClimateField}
        />
      )}

      {activeStep === 3 && (
        <Evaluation
          durationCycles={durationCycles}
          evaluationSyncedRows={evaluationSyncedRows}
          updateEvaluationSyncedRow={updateEvaluationSyncedRow}
          evaluationSummary={evaluationSummary}
          setEvaluationSummary={setEvaluationSummary}
          table2Rows={table2Rows}
          updateTable2Row={updateTable2Row}
          evaluationSummary2={evaluationSummary2}
          setEvaluationSummary2={setEvaluationSummary2}
        />
      )}

      {activeStep === 4 && (
        <TestReportPreview
          reportInfo={reportInfo}
          subjectTask={subjectTask}
          testMethod={testMethod}
          durationCycles={durationCycles}
          condensationDuration={condensationDuration}
          cycleDurations={CYCLE_DURATIONS}
          cyclesData={cyclesData}
          corrosionCrosscutData={corrosionCrosscutData}
          condensationCrosscutData={condensationCrosscutData}
          constantClimateData={constantClimateData}
          corrosionReferenceImages={corrosionReferenceImages}
          condensationReferenceImages={condensationReferenceImages}
          evaluationSyncedRows={evaluationSyncedRows}
          evaluationSummary={evaluationSummary}
          table2Rows={table2Rows}
          evaluationSummary2={evaluationSummary2}
          cwtBegin={cwtBegin}
          cwtEnd={cwtEnd}
          imageSizeOverrides={imageSizeOverrides}
          setImageOverride={setImageOverride}
          captionOverrides={captionOverrides}
          setCaptionOverride={setCaptionOverride}
          onSave={handleSave}
        />
      )}

      {/* ===================== FOOTER NAV ===================== */}
      <div className="testreport-footer">
        <button type="button" className="testreport-btn" onClick={goBack} disabled={activeStep === 0}>
          <ArrowLeft size={14} />
          {t("testReport.back")}
        </button>

        <button
          type="button"
          className="testreport-btn testreport-btn--solid"
          onClick={goNext}
          disabled={activeStep === STEPS.length - 1}
        >
          {t("testReport.next")}
          <ArrowRight size={14} />
        </button>
      </div>
    </main>
  );
};

export default TestReport;
