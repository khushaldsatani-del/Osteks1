import { Settings, Clock, Scissors, SprayCan, Cloud, Droplets } from "lucide-react";

// Only "Basic Information" (step 1) has a given design — the other four
// steps are real, navigable stops in the same stepper (so Back/Next and the
// step dots already work end-to-end), but render a plain placeholder card
// until their own field layouts are specified, rather than guessing content
// that wasn't given.
export const STEPS = [
  "stepBasicInfo",
  "stepTestConditions",
  "stepResults",
  "stepEvaluation",
  "stepPreviewExport",
];

// Material and Created By are editable comboboxes now (a plain <input>
// with a <datalist> of suggestions) — the user can pick one of these or
// type their own, so the label still translates for the suggestions but
// the stored value is whatever text ends up in the field.
const MATERIAL_VALUES = ["Black Sheet Steel", "Aluminum", "Galvanized Steel"];
const MATERIAL_LABEL_KEYS = {
  "Black Sheet Steel": "testReport.materialBlackSheetSteel",
  Aluminum: "testReport.materialAluminum",
  "Galvanized Steel": "testReport.materialGalvanizedSteel",
};
export const getMaterialOptions = (t) => MATERIAL_VALUES.map((value) => ({ value, label: t(MATERIAL_LABEL_KEYS[value]) }));

// Created By suggestions — a combobox (pick-or-type-your-own), but the
// three seeded names still need their salutation localized (Mr./Mrs. vs.
// Herr/Frau) so a name picked straight from the list already reads right
// in the active language.
const CREATED_BY_KEYS = ["testReport.createdByBreitfeld", "testReport.createdByScholz", "testReport.createdByWeber"];
export const getCreatedByOptions = (t) => CREATED_BY_KEYS.map((key) => t(key));

export const toOptions = (values) => values.map((v) => ({ value: v, label: v }));

// Which of Test Conditions' two reference cards/behaviors applies for a
// given Test Method — matched on the standard's own code number rather
// than the full sentence, since that stays stable even if the Tests
// list's wording (Basic Information's free-text Tests field, which is
// where the Test Method dropdown's options actually come from) is edited.
// Shared by TestConditions.jsx (which card to show) and GeneralCard.jsx
// (whether Test Duration is a real cycle picker or a fixed "240 h").
export const isCorrosionChangeTest = (testMethod) => /PV\s*1210/i.test(testMethod || "");
export const isCondensationClimateTest = (testMethod) => /6270-2|kondenswasser|condensation water/i.test(testMethod || "");

// firmaInfo.enquiryDate elsewhere (see DocPreview.jsx) is formatted the same
// way — a native <input type="date"> value ("YYYY-MM-DD") shown as plain
// dd.mm.yyyy.
export const formatDateDots = (isoDate) => {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
};

// isoDate + days, as "YYYY-MM-DD" — only used to seed the Condensation
// Water Constant Climate card's End date input with a sensible default
// (Start + 10 days, i.e. 240 h) the user can then type over; Beginn/Ende
// are real inputs (see cwtBegin/cwtEnd), not recomputed on every render.
// Built from local date parts, not a UTC round-trip, which can silently
// roll the date back a day depending on the browser's timezone.
export const addDaysIso = (isoDate, days) => {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// "One Test Cycle (24 h)" — the fixed 3-phase salt-spray/climate/humidity
// sequence defined by the corrosion-change test standard (VW PV 1210 and
// equivalents commonly follow this exact split). Reference content, same
// role as docPreviewContent.js's static sample data — swap in real
// per-test-method data once Test Conditions is wired to a real standards
// lookup instead of always showing this one cycle. A function (not a plain
// constant) because every title/label here is app UI chrome, not frozen
// document text, so it must stay reactive to the language toggle rather
// than being seeded once — standard codes and pure numeric/unit values are
// left as plain literals since those read identically in either language.
export const getCyclePhases = (t) => [
  {
    key: "saltSpray",
    theme: "orange",
    Icon: SprayCan,
    title: t("testReport.cyclePhaseSaltSprayTitle"),
    standard: "DIN EN ISO 9227",
    duration: "4 h",
    rows: [
      [t("testReport.labelTestSolution"), "5 ± 1 % NaCl in VEW"],
      [t("testReport.labelPhValue"), "6.5 to 7.2"],
      [t("testReport.labelTemperature"), "35 °C"],
      [t("testReport.labelSprayRate"), "1 – 2 ml/h per 80 cm²"],
    ],
  },
  {
    key: "normalClimate",
    theme: "blue",
    Icon: Cloud,
    title: t("testReport.cyclePhaseNormalClimateTitle"),
    standard: "ISO 554-23/50",
    duration: "4 h",
    rows: [
      [t("testReport.labelTemperature"), "23 ± 5 °C"],
      [t("testReport.labelRelativeHumidity"), "50 ± 5 %"],
      [t("testReport.labelDuration"), "4 h"],
    ],
  },
  {
    key: "humidityHeat",
    theme: "green",
    Icon: Droplets,
    // The flow diagram above uses the short name; the detail card below it
    // uses the standard's full official name — same phase, same standard.
    flowTitle: t("testReport.cyclePhaseHumidityHeatFlowTitle"),
    title: t("testReport.cyclePhaseHumidityHeatTitle"),
    standard: "DIN EN ISO 6270-2 CH",
    duration: "16 h",
    rows: [
      [t("testReport.labelTemperature"), "40 ± 2 °C"],
      [t("testReport.labelRelativeHumidity"), t("testReport.cyclePhaseHumidityValue")],
      [t("testReport.labelDuration"), "16 h"],
    ],
  },
];

// The fixed set of checkpoint values Test Conditions' "Test Duration
// (Cycles)" dropdown offers — also the full set of cycle rail items
// cyclesData ever needs to hold (see buildResultSections below), so a
// checkpoint's data is never lost just because it's temporarily not shown.
export const CYCLE_DURATIONS = [5, 15, 30, 60, 120, 240];

// The left rail inside Results — one entry per checkpoint the test method
// defines. Only "5 Cycles" (and, by the same pattern, every other cycle
// count) has a given design — Overview / Delamination Measurement /
// Cross-cut Test are real, selectable stops so the rail is fully
// navigable, but show the same plain placeholder Steps 4-5 use until their
// own layouts are specified.
//
// The cycle entries themselves are dynamic, not a fixed list: Test
// Conditions' Test Duration (Cycles) dropdown picks how many cycles this
// report actually runs, and the rail shows every checkpoint up to and
// including that value (e.g. duration=120 -> 5/15/30/60/120 all appear;
// duration=5 -> only 5 Cycles appears) — a checkpoint the test method
// doesn't reach yet has nothing to show a result for.
// `subjectTask` is optional (some callers, like the "which rail item is
// still valid" check in TestReport.jsx, only need the ids and don't have
// it handy) — when omitted, both Cross-cut Test rail entries are shown, the
// same as always having both tests apply.
export function buildResultSections(durationCycles, t, subjectTask) {
  const duration = Number(durationCycles) || 0;
  const cycleSections = CYCLE_DURATIONS.filter((cycles) => cycles <= duration).map((cycles) => ({
    id: `cycles${cycles}`,
    label: t("testReport.railCyclesLabel", { cycles }),
    Icon: Clock,
    kind: "cycles",
    cycles,
  }));

  const tests = subjectTask?.tests;
  const hasCorrosionTest = !tests || tests.some(isCorrosionChangeTest);
  const hasCondensationTest = !tests || tests.some(isCondensationClimateTest);

  // "Delamination Measurement" used to be its own rail entry here (an
  // unbuilt placeholder) — removed on request. The real ISO 4628-8
  // delamination cards (auto-triggered on a Fail/Conditional row, or
  // button-revealed at the last cycle) are unrelated and unaffected; they
  // live inside each cycle's own content, not as a standalone rail stop.
  //
  // Cross-cut Test is two independent rail entries now, not one with a
  // dropdown — each shown only when its own test actually applies to this
  // report (from Basic Information's Tests list), so a report running only
  // the corrosion test never shows an irrelevant condensation crosscut
  // slot, and vice versa.
  return [
    { id: "overview", label: t("testReport.railOverview"), Icon: Settings, kind: "placeholder" },
    ...cycleSections,
    { id: "constantClimate", label: t("testReport.railConstantClimate"), Icon: Droplets, kind: "placeholder" },
    ...(hasCorrosionTest
      ? [{ id: "crosscutCorrosion", label: t("testReport.crosscutRailCorrosion"), Icon: Scissors, kind: "placeholder" }]
      : []),
    ...(hasCondensationTest
      ? [{ id: "crosscutCondensation", label: t("testReport.crosscutRailCondensation"), Icon: Scissors, kind: "placeholder" }]
      : []),
  ];
}

// Same 4 visual-inspection criteria checked at every cycle checkpoint —
// pre-filled with the "everything passed" sample text from the reference
// design (editable per row: the tester overwrites Observation/Result and
// Assessment after actually inspecting the part; Criteria/Requirement come
// from the test method itself, so those two columns are looked up fresh by
// id via getInspectionCriteriaLabel/getInspectionRequirementLabel below
// rather than being frozen into state — they're never user-edited, so they
// must stay reactive to the language toggle for as long as the wizard is
// open, not just at the moment it was opened).
export const DEFAULT_INSPECTION_ROW_IDS = ["blisters", "zincCorrosion", "baseMetalCorrosion", "coatingCondition", "others"];

const INSPECTION_CRITERIA_KEYS = {
  blisters: "testReport.inspectionCriteriaBlisters",
  zincCorrosion: "testReport.inspectionCriteriaZincCorrosion",
  baseMetalCorrosion: "testReport.inspectionCriteriaBaseMetalCorrosion",
  coatingCondition: "testReport.inspectionCriteriaCoatingCondition",
  others: "testReport.inspectionCriteriaOthers",
};

const INSPECTION_REQUIREMENT_KEYS = {
  blisters: "testReport.inspectionReqNoBlisters",
  zincCorrosion: "testReport.inspectionReqNoZincCorrosion",
  baseMetalCorrosion: "testReport.inspectionReqNoRelevantChanges",
  coatingCondition: "testReport.inspectionReqNoRelevantChanges",
  others: null, // "-" — a placeholder dash, not a word, so no key needed
};

export const getInspectionCriteriaLabel = (t, id) => t(INSPECTION_CRITERIA_KEYS[id]);
export const getInspectionRequirementLabel = (t, id) => (INSPECTION_REQUIREMENT_KEYS[id] ? t(INSPECTION_REQUIREMENT_KEYS[id]) : "-");

// Observation is the one editable column of the four — seeded here from the
// same "everything passed" text as Requirement, in whichever language is
// active when the wizard mounts, exactly like any other freeform starting
// value the tester then overwrites after actually inspecting the part.
export const getDefaultInspectionRows = (t) =>
  DEFAULT_INSPECTION_ROW_IDS.map((id) => ({
    id,
    observation: getInspectionRequirementLabel(t, id),
    assessment: "Pass",
  }));

// Canonical values stay the fixed English words Pass/Fail/Conditional
// (used for equality checks and the testreport-assessment--{value} CSS
// class elsewhere) — only the option's displayed label translates.
export const getAssessmentOptions = (t) => [
  { value: "Pass", label: t("testReport.assessmentPass") },
  { value: "Fail", label: t("testReport.assessmentFail") },
  { value: "Conditional", label: t("testReport.assessmentConditional") },
];

export const DURATION_CYCLES_OPTIONS = toOptions(CYCLE_DURATIONS.map(String));

// Condensation Water Constant Climate test duration — a real user choice,
// not a fixed value: TL 260 alone states 240 h for some Ofl-codes (e.g.
// x634) and 144 h for others (e.g. x630/x330/x631), so the wizard can't
// safely assume one over the other. Language-neutral (a plain hour count),
// so a plain toOptions() array like DURATION_CYCLES_OPTIONS above.
export const CONDENSATION_DURATION_OPTIONS = toOptions(["240 h", "144 h"]);

// Cross-cut Test is now two independent slots (one per test, shown
// whenever that test actually applies to this report — see
// buildResultSections below), not one slot with a dropdown picking which
// test it belongs to. These two label getters are what each slot's fixed
// "Upload cross-cut image for X" caption reads from.
export const getCrosscutCorrosionLabel = (t) => t("testReport.crosscutAssignCorrosion");
export const getCrosscutCondensationLabel = (t) => t("testReport.crosscutAssignCondensation");

// Reference "Result" / "Requirement" narrative text per cycle checkpoint —
// same role as Step 2's getCyclePhases / Step 3's getDefaultInspectionRows:
// static sample content the user edits into their own words (both fields
// are real AutoTextarea inputs), so this is only the starting seed shown
// when the wizard first mounts, in whichever language is active then —
// not something generated from Step 3's actual data (composing accurate
// technical prose from arbitrary inspection rows isn't something to fake
// reliably).
export const getEvaluationSeedText = (t) => ({
  5: {
    result: t("testReport.evalSeed5Result"),
    requirement: t("testReport.evalSeed5Requirement"),
  },
  15: {
    result: t("testReport.evalSeed15Result"),
    requirement: t("testReport.evalSeed15Requirement"),
  },
  30: {
    result: t("testReport.evalSeed30Result"),
    requirement: t("testReport.evalSeed30Requirement"),
  },
  60: {
    result: t("testReport.evalSeed15Result"),
    requirement: t("testReport.evalSeed60Requirement"),
  },
});

// Table 2's fixed rows — one per criterion, all checked at the same 240 h
// endpoint (this test doesn't have intermediate cycle checkpoints the way
// Table 1's corrosion-change test does). Both columns are editable
// AutoTextarea inputs, so — same as getEvaluationSeedText above — this is
// only the starting seed shown when the wizard first mounts.
export const getEvaluationTable2SeedRows = (t) => [
  { id: "blisters", duration: "240h", result: t("testReport.evalSeed5Result"), requirement: t("testReport.evalTable2BlistersRequirement"), assessment: "Fulfilled" },
  { id: "corrosion", duration: "240h", result: t("testReport.evalSeed5Result"), requirement: t("testReport.evalTable2CorrosionRequirement"), assessment: "Fulfilled" },
  { id: "crosscut", duration: "240h", result: "2x Gt0", requirement: t("testReport.evalTable2CrosscutRequirement"), assessment: "Fulfilled" },
];

// Step 2's own summary card for the same Condensation Water Constant
// Climate test — a purely descriptive/reference block (like getCyclePhases
// above it), not an editable form, so — unlike the seed content above — it
// stays fully reactive to the language toggle for as long as the wizard is
// open, the same way any other piece of UI chrome does. `duration` is the
// user's own choice from General's Test Duration dropdown (see
// CONDENSATION_DURATION_OPTIONS above) — not a fixed reference value, since
// TL 260 alone states both 240 h and 144 h depending on the Ofl-code — so
// it's threaded through here rather than baked into the title/durationValue
// like everything else in this object.
export const getCwtSummary = (t, duration = "240 h") => ({
  title: t("testReport.cwtTitle", { duration }),
  subtitle: t("testReport.cwtSubtitle"),
  testMethodLabel: t("testReport.testMethod"),
  testMethodValue: "DIN EN ISO 6270-2 CH:2018-04",
  durationLabel: t("testReport.testDuration"),
  durationValue: duration,
  partsLabel: t("testReport.testParts"),
  conditionsTitle: t("testReport.testConditionsLabel"),
  conditionsRows: [
    [t("testReport.labelTemperature"), "40° +/- 2 °C"],
    [t("testReport.labelRelativeHumidityShort"), t("testReport.cwtConditionsHumidityValue")],
  ],
  equipmentTitle: t("testReport.equipmentTitleLabel"),
  equipmentLines: [t("testReport.cwtEquipmentLine1"), t("testReport.cwtEquipmentLine2")],
  periodTitle: t("testReport.testPeriod"),
  periodBeginLabel: t("testReport.periodBeginLabel"),
  periodEndLabel: t("testReport.periodEndLabel"),
  periodTotalLabel: t("testReport.periodTotalLabel"),
  requirementsTitle: t("testReport.requirementsTitleLabel"),
  requirements: [
    t("testReport.cwtReq1"),
    t("testReport.cwtReq2"),
    { text: t("testReport.cwtReq3Text"), note: t("testReport.cwtReq3Note") },
  ],
});

// Seeded with the same sample record the reference design walks through end
// to end (Report No. "34-25", dates 03.12.2025 → 25.02.2026, etc.) — Step 2's
// "Test Conditions" content is directly derived from these same fields (the
// first Tests entry, the start/end dates), so leaving them genuinely blank
// here would break that link the moment the wizard is opened. Description/
// Test Object/Tests are freeform editable fields, so — same convention as
// getEvaluationSeedText above — they're only seeded in whichever language
// is active when the wizard first mounts.
export const getInitialReportInfo = (t) => ({
  reportNo: "34-25",
  // Doubles as the Prüfgegenstand block's third line in Step 5's preview
  // and the Word export (see TestReportPreview.jsx/buildTestReportDocx.js)
  // — free text now instead of a value auto-built from durationCycles, so
  // it stays in sync with whatever is actually typed here rather than a
  // separate Test Conditions setting. Default matches what that line used
  // to read automatically (at the default 60-cycle duration) so nothing
  // looks different until this field is edited.
  description: t("testReport.initialDescription"),
  testStartDate: "2025-12-03",
  testObjectPart: t("testReport.initialTestObjectPart"),
  sampleReceivedDate: "2025-12-03",
  plannedTestEndDate: "2026-02-25",
});

export const getInitialSubjectTask = (t) => ({
  testSample: "Sample 1",
  partNo: "T04272",
  drawingNo: "",
  quantity: "1",
  material: "Black Sheet Steel",
  // A plain text field now (not a fixed dropdown) — autofilled from the
  // detected norm when a report is created from Document Preview's "Test
  // required", editable otherwise.
  surfaceProtectionType: "VW 13750 Ofi-x634",
  tests: [t("testReport.initialTest1"), t("testReport.initialTest2")],
  createdBy: t("testReport.createdByBreitfeld"),
  // Signature image (Bearbeiter's), uploaded next to Created By — stored
  // like every other photo slot ({objectPath, name, url}), just never
  // shown as a preview in the form itself.
  signature: null,
});
