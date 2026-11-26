import { DEFAULT_SETTINGS } from "../engine/defaults";
import { todayIso } from "../engine/format";

// One offer per process, each with its own parts, so switching KTL <-> Pulver
// never loses what was typed in the other. The letter's texts are the
// standard ones of the chosen language unless edited for this offer -
// edits are kept per language (`texts.de`, `texts.en`).

let counter = 0;
export const newId = () => `p${Date.now().toString(36)}${(counter += 1)}`;

export const emptyKtlPart = () => ({
  id: newId(),
  name: "",
  drawingNo: "",
  paintSpec: "",
  layer: "15 - 25 µm", // B5
  quantity: "", // B2
  surfaceMm2: "", // B3
  weightG: "", // B4
  thicknessMm: "1", // B14
  beizen: true, // B8
  guss: false, // B9
  maskingPoints: "0", // B10
  loadMinutes: "", // B11
  workers: "", // B12
  paint: "D-KTL", // E21
  offerPrice: "", // B34
  remark: "", // A35 - internal, not printed in the offer
});

export const emptyPulverPart = () => ({
  id: newId(),
  name: "",
  description: "", // Artikelbezeichnung
  customerArticleNo: "",
  osteksArticleNo: "",
  quantity: "", // B10 Anfragemenge
  material: "steel", // B16
  weightG: "", // B14
  thicknessMm: "", // B15
  surfaceCm2: "", // B20
  powderPricePerKg: "", // B21
  partLengthM: "", // B23
  partsPerHook: "", // B24
  plugs: "1", // B30
  tapes: "0", // B31
  offerPrice: "", // B40
});

export const emptyOffer = (process) => ({
  customer: { company: "", person: "", address: "" },
  project: "",
  offerNo: "",
  requestDate: "",
  offerDate: todayIso(),
  calculatedBy: "",
  texts: {},
  // the offer's database record (All Documents) - set by the first upload
  // or the first Save, null for an offer that was never stored
  documentId: null,
  parts: [process === "ktl" ? emptyKtlPart() : emptyPulverPart()],
  selectedId: null,
});

export const initialState = () => ({
  process: "ktl",
  offers: { ktl: emptyOffer("ktl"), pulver: emptyOffer("pulver") },
  settings: structuredClone(DEFAULT_SETTINGS),
});

// What links a part to Work Place's upload: its drawing's database row, the
// AI extraction (status, file, text), the norm found for it and its Test
// Report. A copied part is a new part without a drawing.
export const LINK_KEYS = ["documentId", "extraction", "kbSpecification", "hasTestReport", "testReportId"];

const withoutLink = (part) => Object.fromEntries(Object.entries(part).filter(([key]) => !LINK_KEYS.includes(key)));

const emptyPartOf = (process) => (process === "ktl" ? emptyKtlPart() : emptyPulverPart());

// A part nobody has touched yet: everything at its starting value and no
// drawing behind it - the one an upload may take over.
export const isUntouchedPart = (process, part) => {
  const blank = emptyPartOf(process);
  return !part.extraction && Object.keys(blank).every((k) => k === "id" || part[k] === blank[k]);
};

// An offer read back from this browser or the database, made safe to show:
// whatever is missing or of the wrong kind (no parts, no customer, a part
// without an id ...) is filled from an empty offer - a damaged record
// opens with what it has instead of breaking the page.
export const normalizeOffer = (process, raw) => {
  const base = emptyOffer(process);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...base, selectedId: base.parts[0].id };
  const blank = emptyPartOf(process);
  const parts = (Array.isArray(raw.parts) ? raw.parts : [])
    .filter((p) => p && typeof p === "object" && !Array.isArray(p))
    .map((p) => {
      const part = { ...blank, ...p, id: typeof p.id === "string" && p.id ? p.id : newId() };
      // a text field holding an object or a list, a number that is not
      // finite, or a yes/no that is not true/false would break the page -
      // it gets the empty part's value (number boxes store plain numbers)
      for (const [key, fallback] of Object.entries(blank)) {
        const value = part[key];
        if (typeof fallback === "string" && !(typeof value === "string" || typeof value === "number")) part[key] = fallback;
        else if (typeof fallback === "string" && typeof value === "number" && !Number.isFinite(value)) part[key] = fallback;
        else if (typeof fallback === "boolean" && typeof value !== "boolean") part[key] = fallback;
      }
      return part;
    });
  const safeParts = parts.length ? parts : base.parts;
  const customerIn = raw.customer && typeof raw.customer === "object" ? raw.customer : {};
  const text = (value) => (value == null ? "" : String(value));
  return {
    ...base,
    ...raw,
    customer: { ...customerIn, company: text(customerIn.company), person: text(customerIn.person), address: customerIn.address == null ? customerIn.address : text(customerIn.address) },
    texts: raw.texts && typeof raw.texts === "object" && !Array.isArray(raw.texts) ? raw.texts : {},
    parts: safeParts,
    selectedId: safeParts.some((p) => p.id === raw.selectedId) ? raw.selectedId : safeParts[0].id,
  };
};

const updateOffer = (state, fn) => ({
  ...state,
  offers: { ...state.offers, [state.process]: fn(state.offers[state.process]) },
});

export function reducer(state, action) {
  switch (action.type) {
    case "process":
      return { ...state, process: action.process };
    case "offer":
      return updateOffer(state, (o) => ({ ...o, ...action.changes }));
    case "offerIn":
      // one process's offer, whichever is open (Work Place's database link)
      return { ...state, offers: { ...state.offers, [action.process]: { ...state.offers[action.process], ...action.changes } } };
    case "customer":
      return updateOffer(state, (o) => ({ ...o, customer: { ...o.customer, ...action.changes } }));
    case "texts":
      // `texts` holds the full edited set (spec, paragraphs, terms) of one language
      return updateOffer(state, (o) => ({ ...o, texts: { ...o.texts, [action.language]: action.texts } }));
    case "resetTexts":
      return updateOffer(state, (o) => {
        const texts = { ...o.texts };
        delete texts[action.language];
        return { ...o, texts };
      });
    case "select":
      return updateOffer(state, (o) => ({ ...o, selectedId: action.id }));
    case "part": {
      // by id in either offer - an extraction may finish after the user
      // switched between KTL and Powder; `changes` may be a function
      const apply = (p) => (p.id === action.id ? { ...p, ...(typeof action.changes === "function" ? action.changes(p) : action.changes) } : p);
      const offers = Object.fromEntries(Object.entries(state.offers).map(([key, o]) => [key, { ...o, parts: o.parts.map(apply) }]));
      return { ...state, offers };
    }
    case "addPart": {
      const part = action.part ?? emptyPartOf(state.process);
      return updateOffer(state, (o) => ({ ...o, parts: [...o.parts, part], selectedId: part.id }));
    }
    case "addParts":
      // Work Place: empty parts for an upload batch, added behind the others
      // without moving the open tab
      return updateOffer(state, (o) => ({ ...o, parts: [...o.parts, ...action.parts] }));
    case "load":
      // "Open in Workspace": the stored offer replaces this process's offer;
      // the other process starts empty, the settings stay as they are
      return {
        ...state,
        process: action.process,
        offers: { ktl: emptyOffer("ktl"), pulver: emptyOffer("pulver"), [action.process]: normalizeOffer(action.process, action.offer) },
      };
    case "duplicatePart":
      return updateOffer(state, (o) => {
        const src = o.parts.find((p) => p.id === action.id);
        if (!src) return o;
        const copy = { ...withoutLink(src), id: newId(), name: src.name ? `${src.name} ${action.suffix}` : "" };
        const at = o.parts.indexOf(src) + 1;
        return { ...o, parts: [...o.parts.slice(0, at), copy, ...o.parts.slice(at)], selectedId: copy.id };
      });
    case "removePart":
      return updateOffer(state, (o) => {
        const parts = o.parts.filter((p) => p.id !== action.id);
        const keep = parts.length ? parts : [emptyPartOf(state.process)];
        return { ...o, parts: keep, selectedId: keep[0].id };
      });
    case "settings":
      return { ...state, settings: { ...state.settings, [action.process]: { ...state.settings[action.process], ...action.changes } } };
    case "resetSettings":
      return { ...state, settings: { ...state.settings, [action.process]: structuredClone(DEFAULT_SETTINGS[action.process]) } };
    case "newOffer":
      // a new offer is a new record: both processes start empty
      return { ...state, offers: { ktl: emptyOffer("ktl"), pulver: emptyOffer("pulver") } };
    default:
      return state;
  }
}
