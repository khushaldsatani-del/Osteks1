// Every fixed value of the two calculation workbooks, with the cell it comes
// from, so a number on screen can always be checked against the Excel:
//   KTL    "_Kalkulationsschema KTL incl ETZ.xlsx", sheet "Tabellenblatt 1"
//   Pulver "_Kalkulation Pulverbeschichtung mit Material incl.xlsx", "Tabelle1"
// The values are the sheets' own - including the ones still to be confirmed
// (e.g. B26 uses H2, F21 has 0.29 typed in while H3 says 0.19).

// Fixed costs 2025 (I6:Q19): amount, KTL share (M), Pulver share (O);
// Schäumen gets the rest (Q = 1 - O - M).
const FIXED_COSTS = [
  ["Entlackungskosten", 81236, 0.8, 0.2],
  ["Rückstellung Weihnachtsgeld", 126806, 0.75, 0.15],
  ["Gehälter", 538426, 0.75, 0.15],
  ["Gas", 368166, 0.75, 0.15],
  ["Strom", 325059, 0.75, 0.15],
  ["Reparaturen/Instandhaltung", 224712, 0.75, 0.15],
  ["Stapler Reparaturen", 55737, 0.75, 0.15],
  ["Entsorgungskosten Remondis", 64449, 0.75, 0.15],
  ["ext. Reklamationskosten", 103567, 0.75, 0.15],
  ["Fremdleistungen Speditionen", 121894, 0.75, 0.15],
  ["Factoringgebühren", 10536.1, 0.75, 0.15],
  ["Sonstige Kosten", 227980.09, 0.75, 0.15],
  ["AfA", 621874, 0.75, 0.15],
  ["Zinsen (einschl. Factoringzinsen 7318)", 308480, 0.75, 0.15],
].map(([name, amount, ktl, pulver], i) => ({ id: `f${i}`, row: 6 + i, name, amount, ktl, pulver }));

// Variable costs (V6:AD9): amount, KTL (Z), Pulver (AB), Schäumen (AD) - in
// the sheet these three shares are set independently (they add up to 105 %).
const VARIABLE_COSTS = [
  ["Materialeinsatz", 1307709],
  ["Löhne", 2143248],
  ["Fremdleistung Oriones, Grace", 315981],
  ["Lebenshilfe", 173139],
].map(([name, amount], i) => ({ id: `v${i}`, row: 6 + i, name, amount, ktl: 0.75, pulver: 0.15, schaeumen: 0.15 }));

// Materials for the surface-from-weight estimate (B16). The sheet only
// knows steel (7.85); for other metals the estimate would be far off.
export const MATERIALS = [
  { key: "steel", density: null }, // null = the setting B16 (7.85)
  { key: "stainless", density: 7.9 },
  { key: "aluminium", density: 2.7 },
  { key: "castIron", density: 7.2 },
  { key: "zinc", density: 6.6 },
];

export const densityOf = (material, steelDensity) =>
  MATERIALS.find((m) => m.key === material)?.density ?? steelDensity;

export const DEFAULT_SETTINGS = {
  ktl: {
    fixedCosts: FIXED_COSTS,
    variableCosts: VARIABLE_COSTS,
    hoursPerShift: 7.5, // T6
    workingDays: 240, // T7
    availability: 0.85, // T8
    shiftsKtl: 3, // L21 = T11 (dreischichtig)
    shiftsPulver: 2, // N21 = T10
    shiftsSchaeumen: 2, // P21 = T10
    carriersPerHourTable: 6, // T13 / L24
    chainMetresPerHour: 150, // T14 / N24
    // part calculation
    carrierSurfaceM2: 45, // B6
    densitySteel: 7.85, // B15
    castingSurcharge: 0.3, // B17
    etz: 0.255, // B30
    basePerCarrier: 115, // B25: =115/B7+0.08
    basePerPart: 0.08, // B25
    maskingPerPoint: 0.1, // B27: =0.1*B10
    paintDktl: 0.395, // H2 (also used by B26!) and in F21
    paintNktlTable: 0.19, // H3 - shown in the price table, not used by F21
    paintNktlFormula: 0.29, // F21: 0.29*C3
    pretreatNormal: 0.15, // F22: 0.15*C3
    pretreatBeizen: 0.25, // F22: 0.25*C3
    overhead: 0.18, // E28
    minutesPerCarrier: 8, // F4
    utilisation: 0.85, // F5
    wagePerHour: 32, // B13
    workingDaysPerYear: 240, // F33: =B2/(240*B7)
  },
  pulver: {
    usefulHoursPerShift: 5, // H6
    targetBase: 600, // H23: =600*0.79
    targetFactor: 0.79, // H23
    materialShare: 0.21, // H24 (shown only)
    machineRate: 200, // H16 (info)
    workers: 6, // H18 (info)
    wagePerHour: 28, // H19 (info)
    powderDensity: 1.5, // H26
    transferEfficiency: 0.95, // H27: /(0.95*10000)
    gapMetres: 0.6, // D24
    chainSpeed: 2.5, // B26
    layerUm: 120, // B19
    coatingHeight: 1.2, // B22
    densitySteel: 7.85, // B16
    pricePerPlug: 0.1, // E30
    pricePerTape: 0.1, // E31
    etz: 0.255, // B36
  },
};
