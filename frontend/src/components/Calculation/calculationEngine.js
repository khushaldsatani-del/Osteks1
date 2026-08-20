/**
 * Coating cost calculation engine.
 *
 * Every formula below is ported 1:1 from
 * "Final_Documentation_for_calculation.docx" (Terminology & Formula
 * Reference Guide). The section numbers in the comments match the
 * numbered steps in that document so the logic can be cross-checked
 * against the source at any time.
 *
 * All functions are pure (no side effects) and defensively coerce
 * their inputs to numbers so the UI never crashes on empty fields.
 */

const n = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

// Returns the user-typed override when present, otherwise the value the
// formula chain would normally compute — used to let every field in the
// Pricing Analysis card be edited directly while still feeding whatever
// the user typed into the formulas that depend on it.
const withOverride = (override, natural) =>
  override !== undefined && override !== "" ? n(override) : natural;

/** Section 2.1 — Surface Area (mm²) from weight, thickness & density.
 * Formula: Weight * 2000 / (Thickness * Density)
 */
export function calcSurfaceAreaMm2({ weightG, thicknessMm, densityGcm3 }) {
  const weight = n(weightG);
  const thickness = n(thicknessMm);
  const density = n(densityGcm3);
  if (thickness === 0 || density === 0) return 0;
  return (weight * 2000) / (thickness * density);
}

/** Section 2.1 — Surface Area (m²) = Surface Area (mm²) / 1,000,000 */
export function calcSurfaceAreaM2(surfaceAreaMm2) {
  return n(surfaceAreaMm2) / 1_000_000;
}

/** Section 2.3 — Parts per Carrier (Stück pro Warenträger)
 * Formula: IF(INT(carrier_mm2 / part_mm2) > qty, qty, INT(carrier_mm2 / part_mm2))
 * Matches the Excel formula exactly — including when quantity is 0: the
 * sheet then returns 0 (nothing ordered yet, so nothing to load), not the
 * carrier's raw capacity.
 */
export function calcPartsPerCarrier({ carrierSurfaceM2, surfaceAreaMm2, quantity }) {
  const carrier = n(carrierSurfaceM2);
  const partArea = n(surfaceAreaMm2);
  const qty = n(quantity);
  if (partArea === 0) return 0;

  const fitOnCarrier = Math.floor((carrier * 100 * 100 * 100) / partArea);
  return fitOnCarrier > qty ? qty : fitOnCarrier;
}

/** Section 2.4 — Base Price per Part (Preis pro Teil)
 * Formula: 115 / partsPerCarrier + 0.08
 */
export function calcBasePricePerPart(partsPerCarrier) {
  const parts = n(partsPerCarrier);
  if (parts === 0) return 0;
  return 115 / parts + 0.08;
}

/** Section 2.5 — Pickling Cost (Beizen), only applied when beizenJN === "j"
 * Formula: rate(0.25 €/m²) * surfaceAreaMm2 / 1,000,000
 */
export function calcPicklingCost({ beizenJN, surfaceAreaMm2, ratePerM2 = 0.25 }) {
  if (beizenJN !== "j") return 0;
  return (ratePerM2 * n(surfaceAreaMm2)) / 1_000_000;
}

/** Section 2.6 — Masking Cost (Maskierung)
 * Formula: 0.1 * maskingPoints
 */
export function calcMaskingCost(maskingPoints, ratePerPoint = 0.1) {
  return ratePerPoint * n(maskingPoints);
}

/** Section 2.7 — Casting Surcharge (Gußzuschlag), only when gussteilJN === "j"
 * Formula: (basePricePerPart + picklingCost) * surchargePercent
 */
export function calcCastingSurcharge({
  gussteilJN,
  basePricePerPart,
  picklingCost,
  surchargePercent,
}) {
  if (gussteilJN !== "j") return 0;
  return (n(basePricePerPart) + n(picklingCost)) * (n(surchargePercent) / 100);
}

/** Section 2.8 — Total Price / Summe
 * Formula: base + pickling + masking + casting
 */
export function calcTotalPrice({
  basePricePerPart,
  picklingCost,
  maskingCost,
  castingSurcharge,
}) {
  return n(basePricePerPart) + n(picklingCost) + n(maskingCost) + n(castingSurcharge);
}

/** Section 2.10 — Kalkulierter Preis (Final Calculated Price)
 * Formula: totalPrice * (1 + etzPercent)
 */
export function calcKalkulierterPreis({ totalPrice, etzPercent }) {
  return n(totalPrice) * (1 + n(etzPercent) / 100);
}

/** Section 2.11 — Weight per Carrier (kg)
 * Formula: partsPerCarrier * weightG / 1000
 */
export function calcWeightPerCarrierKg({ partsPerCarrier, weightG }) {
  return (n(partsPerCarrier) * n(weightG)) / 1000;
}

/** Section 4, Row 23 — Revenue per Carrier (Umsatz pro Warenträger)
 * Formula: partsPerCarrier * totalPrice (Summe, pre-ETZ)
 */
export function calcRevenuePerCarrier({ partsPerCarrier, totalPrice }) {
  return n(partsPerCarrier) * n(totalPrice);
}

/** Section 4, Row 24 — Revenue per m² (Umsatz pro m²)
 * Formula: totalPrice * 1,000,000 / surfaceAreaMm2
 */
export function calcRevenuePerM2({ totalPrice, surfaceAreaMm2 }) {
  const area = n(surfaceAreaMm2);
  if (area === 0) return 0;
  return (n(totalPrice) * 1_000_000) / area;
}

/** Section 4, Row 25 — Annual Revenue (Umsatz pro Jahr)
 * Formula: offerPrice * quantity
 */
export function calcAnnualRevenue({ offerPrice, quantity }) {
  return n(offerPrice) * n(quantity);
}

/** Section 3, Row 46 — Offer Price per m² (AngebotsPreis pro m²)
 * Formula: offerPrice * 1,000,000 / surfaceAreaMm2
 */
export function calcOfferPricePerM2({ offerPrice, surfaceAreaMm2 }) {
  const area = n(surfaceAreaMm2);
  if (area === 0) return 0;
  return (n(offerPrice) * 1_000_000) / area;
}

/** Section 3, Row 47 — Offer Revenue per Carrier (AngebotsUmsatz/Warenträger)
 * Formula: offerPrice * partsPerCarrier
 */
export function calcOfferRevenuePerCarrier({ offerPrice, partsPerCarrier }) {
  return n(offerPrice) * n(partsPerCarrier);
}

/** Section 3, Row 48 — Offer Price per kg (AngebotsPreis/kg)
 * Formula: offerPrice * 1000 / weightG
 */
export function calcOfferPricePerKg({ offerPrice, weightG }) {
  const weight = n(weightG);
  if (weight === 0) return 0;
  return (n(offerPrice) * 1000) / weight;
}

/**
 * Runs the full calculation chain in the same order as the Excel sheet.
 * Accepts the raw form state and returns every intermediate + final value.
 */
export function runFullCalculation(inputs) {
  const {
    weightG,
    thicknessMm,
    densityGcm3,
    quantity,
    beizenJN,
    gussteilJN,
    gusszuschlagPercent,
    maskierungStueck,
    carrierSurfaceM2,
    etzPercent,
    offerPrice,
    surfaceAreaMm2: surfaceAreaMm2Override,
    partsPerCarrier: partsPerCarrierOverride,
    basePricePerPart: basePricePerPartOverride,
    picklingCost: picklingCostOverride,
    maskingCost: maskingCostOverride,
    castingSurcharge: castingSurchargeOverride,
    totalPrice: totalPriceOverride,
    kalkulierterPreis: kalkulierterPreisOverride,
    weightPerCarrierKg: weightPerCarrierKgOverride,
  } = inputs;

  // Every value below is normally derived from the ones before it, but the
  // Pricing Analysis card lets the user type directly into any of them — in
  // that case every downstream formula uses the typed override instead.
  const naturalSurfaceAreaMm2 = calcSurfaceAreaMm2({ weightG, thicknessMm, densityGcm3 });
  const surfaceAreaMm2 = withOverride(surfaceAreaMm2Override, naturalSurfaceAreaMm2);
  const surfaceAreaM2 = calcSurfaceAreaM2(surfaceAreaMm2);

  const naturalPartsPerCarrier = calcPartsPerCarrier({
    carrierSurfaceM2,
    surfaceAreaMm2,
    quantity,
  });
  const partsPerCarrier = withOverride(partsPerCarrierOverride, naturalPartsPerCarrier);

  const naturalBasePricePerPart = calcBasePricePerPart(partsPerCarrier);
  const basePricePerPart = withOverride(basePricePerPartOverride, naturalBasePricePerPart);

  const naturalPicklingCost = calcPicklingCost({ beizenJN, surfaceAreaMm2 });
  const picklingCost = withOverride(picklingCostOverride, naturalPicklingCost);

  const naturalMaskingCost = calcMaskingCost(maskierungStueck);
  const maskingCost = withOverride(maskingCostOverride, naturalMaskingCost);

  const naturalCastingSurcharge = calcCastingSurcharge({
    gussteilJN,
    basePricePerPart,
    picklingCost,
    surchargePercent: gusszuschlagPercent,
  });
  const castingSurcharge = withOverride(castingSurchargeOverride, naturalCastingSurcharge);

  const naturalTotalPrice = calcTotalPrice({
    basePricePerPart,
    picklingCost,
    maskingCost,
    castingSurcharge,
  });
  const totalPrice = withOverride(totalPriceOverride, naturalTotalPrice);

  const naturalKalkulierterPreis = calcKalkulierterPreis({ totalPrice, etzPercent });
  const kalkulierterPreis = withOverride(kalkulierterPreisOverride, naturalKalkulierterPreis);

  const naturalWeightPerCarrierKg = calcWeightPerCarrierKg({ partsPerCarrier, weightG });
  const weightPerCarrierKg = withOverride(weightPerCarrierKgOverride, naturalWeightPerCarrierKg);

  const revenuePerCarrier = calcRevenuePerCarrier({ partsPerCarrier, totalPrice });
  const revenuePerM2 = calcRevenuePerM2({ totalPrice, surfaceAreaMm2 });
  const annualRevenue = calcAnnualRevenue({ offerPrice, quantity });

  const offerPricePerM2 = calcOfferPricePerM2({ offerPrice, surfaceAreaMm2 });
  const offerRevenuePerCarrier = calcOfferRevenuePerCarrier({ offerPrice, partsPerCarrier });
  const offerPricePerKg = calcOfferPricePerKg({ offerPrice, weightG });

  return {
    naturalSurfaceAreaMm2,
    surfaceAreaMm2,
    surfaceAreaM2,
    naturalPartsPerCarrier,
    partsPerCarrier,
    naturalBasePricePerPart,
    basePricePerPart,
    naturalPicklingCost,
    picklingCost,
    naturalMaskingCost,
    maskingCost,
    naturalCastingSurcharge,
    castingSurcharge,
    naturalTotalPrice,
    totalPrice,
    naturalKalkulierterPreis,
    kalkulierterPreis,
    naturalWeightPerCarrierKg,
    weightPerCarrierKg,
    revenuePerCarrier,
    revenuePerM2,
    annualRevenue,
    offerPricePerM2,
    offerRevenuePerCarrier,
    offerPricePerKg,
  };
}
