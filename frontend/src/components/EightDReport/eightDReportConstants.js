// Only "General Information" (step 1) has a given design (see the
// screenshot this page was built from) — the other three steps are real,
// navigable stops in the same stepper (Back/Next and the step dots already
// work end-to-end for all four), but render a plain placeholder card until
// their own field layouts are specified, rather than guessing content that
// wasn't given. Same approach already used for Test Report's own wizard
// when it was first built (see testReportConstants.js's STEPS comment).
export const STEPS = ["stepGeneralInfo", "step3DInfo", "step8DInfo", "stepViewReport"];

// The people who fill these reports most often, offered in every name /
// person-in-charge field (PersonInput). Picking one in a field that has
// department / phone / e-mail beside it (step 1's Supplier Contact, step 2's
// Team table) fills those in too. Department is the code used on the form.
export const KNOWN_PEOPLE = [
  { name: "T. Breitfeld", department: "PL", phone: "037349/134-64", email: "breitfeld@osteks.de" },
  { name: "Schiemeck Ina", department: "QM", phone: "037349/134-55", email: "schiemeck@osteks.de" },
  { name: "Georg Scholz", department: "PL", phone: "037349/134-43", email: "scholz@osteks.de" },
];

// Department is a fixed CustomSelect (same pattern as Test Report's
// Material field) — standard supplier-quality-department set. Not from a
// given design; a reasonable default list, easy to extend later.
const DEPARTMENT_VALUES = ["QM", "Produktion", "Einkauf", "Vertrieb", "Entwicklung", "Logistik"];
const DEPARTMENT_LABEL_KEYS = {
  QM: "eightD.departmentQM",
  Produktion: "eightD.departmentProduction",
  Einkauf: "eightD.departmentPurchasing",
  Vertrieb: "eightD.departmentSales",
  Entwicklung: "eightD.departmentDevelopment",
  Logistik: "eightD.departmentLogistics",
};
export const getDepartmentOptions = (t) =>
  DEPARTMENT_VALUES.map((value) => ({ value, label: t(DEPARTMENT_LABEL_KEYS[value]) }));

// Step 1's seed record — every field blank, same "nothing calculated/
// guessed until the user fills it in" convention as Calculation's own
// initialState.
export const getInitialGeneralInfo = () => ({
  customerReferenceNumber: "",
  reportNo: "",
  customerItemNo: "",
  supplierItemNo: "",
  partName: "",
  rejectedPartsCount: "",
  complaintDate: "",
  startDate: "",
  statusDate: "",
  supplierContact: "",
  department: "",
  phoneNo: "",
  customerLocation: "",
  // "accepted" | "rejected" | "" — one of two mutually-exclusive states,
  // rendered as a two-option checkbox-style toggle (see the screenshot),
  // not a free second independent flag.
  complaintStatus: "",
});

// ---------- Step 2: 3D Report Information ----------

// Team members and containment actions are user-growable row lists; each
// row carries its own id so React keys stay stable across add/remove, and
// so a containment action can point at its person in charge by member id
// (renaming a team member then follows through automatically).
let rowIdCounter = 0;
const nextRowId = (prefix) => `${prefix}-${Date.now()}-${++rowIdCounter}`;

export const makeTeamMember = () => ({ id: nextRowId("member"), name: "", department: "", phone: "", email: "" });

export const makeContainmentAction = () => ({
  id: nextRowId("action"),
  action: "",
  person: "",
  dueDate: "",
  completionDate: "",
});

// The three "... parts affected?" rows, in display order. Only the shipped
// row carries the extra Delivery Note No. / Quantity fields.
export const AFFECTED_ROWS = [
  { key: "stock", labelKey: "eightD.stockAffected" },
  { key: "inProcess", labelKey: "eightD.inProcessAffected" },
  { key: "shipped", labelKey: "eightD.shippedAffected" },
];

export const getInitialThreeDInfo = () => ({
  team: [makeTeamMember(), makeTeamMember()],
  customerFailure: "",
  osteksFailure: "",
  // answer: "no" | "yes" | "" (mutually exclusive); sorted is independent.
  affected: {
    stock: { answer: "", sorted: false },
    inProcess: { answer: "", sorted: false },
    shipped: { answer: "", sorted: false },
  },
  deliveryNoteNo: "",
  quantity: "",
  actions: [makeContainmentAction(), makeContainmentAction()],
});

// ---------- Step 3: 8D Report Information ----------

export const makeCorrectiveAction = () => ({
  id: nextRowId("corrective"),
  action: "",
  person: "",
  dueDate: "",
  completionDate: "",
});

// Section 7's No / Yes / n/a questions, in display order, as two visual
// groups: the FMEA pair (free-text "Begruendung No/Nr." beside each) and
// the follow-up checks (free-text "Result" beside each).
export const FMEA_ROWS = [
  { key: "fmeaCheck", labelKey: "eightD.fmeaCheck" },
  { key: "fmeaUpdate", labelKey: "eightD.fmeaUpdate" },
];

export const FOLLOW_UP_ROWS = [
  { key: "controlPlan", labelKey: "eightD.controlPlanUpdate" },
  { key: "inspectionPlan", labelKey: "eightD.inspectionPlanUpdate" },
  { key: "otherProcesses", labelKey: "eightD.otherProcessesConcerned" },
];

export const getInitialEightDInfo = () => ({
  rootCause: "",
  correctiveActions: [makeCorrectiveAction()],
  implementedActions: [makeCorrectiveAction()],
  preventiveActions: [makeCorrectiveAction()],
  // One entry per FMEA_ROWS/FOLLOW_UP_ROWS key. answer: "no" | "yes" |
  // "na" | "" (mutually exclusive); text is the free-text field beside it.
  closureDate: "",
  closurePerson: "",
  remarks: "",
  checks: Object.fromEntries(
    [...FMEA_ROWS, ...FOLLOW_UP_ROWS].map(({ key }) => [key, { answer: "", text: "" }])
  ),
});
