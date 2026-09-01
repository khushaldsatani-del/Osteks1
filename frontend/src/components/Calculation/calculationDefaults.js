// Pulled out of Calculation.jsx into their own module on purpose: Vite's
// React Fast Refresh only preserves component state across edits when a
// file exports *only* components — a file mixing a component default
// export with plain-data named exports (like these) breaks that boundary
// and was observed causing spurious duplicate mounts of Calculation when
// switching image slots. Keeping these here, imported by both
// Calculation.jsx and Documents.jsx, avoids that entirely.

import { runFullCalculation } from "./calculationEngine";

// Pricing Analysis fields that are normally computed but can be typed over
// directly. Each auto-follows its calculated ("natural") value, at the
// given decimal precision, until the user edits it themselves.
export const AUTO_SYNC_FIELDS = [
  ["partsPerCarrier", "naturalPartsPerCarrier", 0],
  ["basePricePerPart", "naturalBasePricePerPart", 4],
  ["picklingCost", "naturalPicklingCost", 4],
  ["maskingCost", "naturalMaskingCost", 2],
  ["castingSurcharge", "naturalCastingSurcharge", 2],
  ["totalPrice", "naturalTotalPrice", 4],
  ["kalkulierterPreis", "naturalKalkulierterPreis", 4],
  ["weightPerCarrierKg", "naturalWeightPerCarrierKg", 2],
];

// Used by Documents.jsx to mark every auto-sync field as "touched" when
// hydrating a reopened record — reopening must never silently recalculate
// over a number that was actually saved.
export const AUTO_SYNC_FIELD_NAMES = AUTO_SYNC_FIELDS.map(([field]) => field);

// Everything starts at zero/unselected — nothing is calculated until the
// user actually fills in the fields a given formula depends on. Firma
// Information (companyName/address/offerNumber/enquiryDate) is NOT part of
// this state — it's shared across all of an offer's images, owned by
// Documents.jsx and passed in via firmaValues/onFirmaChange.
// Used by Documents.jsx to merge a fresh extraction's parsed
// weight/thickness/density into a full values object when seeding or
// re-seeding a slot's calcState, without duplicating this field list.
export const initialState = {
  weightG: "0",
  thicknessMm: "0",
  densityGcm3: "",
  schichtdickeUm: "",
  quantity: "0",
  beizenJN: "j",
  gussteilJN: "",
  gusszuschlagPercent: "30",
  maskierungStueck: "0",

  surfaceAreaMm2: "",
  surfaceAreaM2: "",

  carrierSurfaceM2: "45",
  etzPercent: "25.5",
  offerPrice: "0",

  partsPerCarrier: "",
  basePricePerPart: "",
  picklingCost: "",
  maskingCost: "",
  castingSurcharge: "",
  totalPrice: "",
  kalkulierterPreis: "",
  weightPerCarrierKg: "",
};

// Same "blank out untouched auto-synced fields before feeding the engine"
// logic Calculation.jsx's own `results` used to inline — pulled out here so
// Documents.jsx's "Save" can recompute a non-active slot's results (kalkul-
// ierter Preis, total price, etc.) from its stored values/touched flags
// without duplicating this logic. `touched` is the same shape stored in
// calcState: `{ surfaceArea: bool, autoSync: string[] }`.
export function computeCalcResults(values, touched = {}) {
  const engineInputs = { ...values };
  if (!touched.surfaceArea) {
    engineInputs.surfaceAreaMm2 = "";
    engineInputs.surfaceAreaM2 = "";
  }
  const autoSyncTouched = new Set(touched.autoSync ?? []);
  for (const [field] of AUTO_SYNC_FIELDS) {
    if (!autoSyncTouched.has(field)) {
      engineInputs[field] = "";
    }
  }
  return runFullCalculation(engineInputs);
}

// The exact same 4-field mapping Calculation.jsx's own onSyncOfferFields
// effect reports up to Offer Details (Schichtdicke in µm, Quantity,
// Kalkulierter Preis, Maskierung pro Teil) — but callable directly from a
// slot's stored calcState.values, for a slot that has no live Calculation
// instance currently mounted to report it itself. Used by Documents.jsx
// both when hydrating a reopened record (before any Calculation has
// mounted for any slot yet) and when building Document Preview's data for
// every image slot OTHER than the currently active one — see
// offerDetailsRows.js's own comment for why a non-active slot can't just
// rely on its last-reported (and possibly stale) syncedOfferFields
// snapshot.
export function deriveSyncedOfferFields(calcValues) {
  if (!calcValues) return {};
  return {
    schichtdicke: calcValues.schichtdickeUm,
    jahresmenge: calcValues.quantity,
    preisBeschichtung: calcValues.kalkulierterPreis,
    preisMaskierung: calcValues.maskingCost,
  };
}
