import { eur, num, pct } from "../../engine/format";

// Every calculated value of the KTL / Powder sheet with its formula, in the
// order the sheet calculates - for the "KTL / Powder · Calculation" tabs.
// The texts are in the dictionaries (settings.formulas.*); the numbers put
// into them come from the current settings, so the page always explains
// the calculation as it really runs right now.

const fill = (template, vars) => String(template).replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match));

// [section, [cells...]] - `strong` marks a section's result, `info` a value
// that is shown for information and not used in the price
const KTL_LAYOUT = [
  ["machine", ["T9", "L21", "L20", ["L22", "strong"]]],
  ["part", ["C3", "B7", "B16", "F6", "F9", "F10", "F11"]],
  ["price", ["F21", "F22", "F23", "F24", "F25", "F26", "F27", "F28", "F29", "F30", ["F32", "strong"]]],
  ["figures", ["B20", "B21", "B22", "B23", "F33", "F34"]],
  ["old", ["B25", "B26", "B27", "B28", "B29", ["B32", "strong"]]],
  ["info", [["L25", "info"], ["L26", "info"], ["L27", "info"]]],
];

const PULVER_LAYOUT = [
  ["target", [["H23", "strong"], "H7"]],
  ["surface", ["B17", "D20"]],
  ["hanging", ["B25", ["H10", "strong"], "H11"]],
  ["price", ["B29", "B33", "H27", "B34", "B35", ["B37", "strong"], "D35"]],
  ["info", [["H12", "info"], ["H17", "info"], ["H20", "info"], ["H30", "info"]]],
];

const ktlVars = (s, table) => {
  const carriersPerHour = s.minutesPerCarrier > 0 ? 60 / s.minutesPerCarrier : null;
  return {
    hoursPerShift: num(s.hoursPerShift, 1),
    workingDays: num(s.workingDays),
    availability: pct(s.availability, 0),
    hoursOne: num(table.onePerYear),
    shifts: num(s.shiftsKtl),
    hoursKtl: num(table.hours.ktl),
    fixedKtl: eur(table.totals.ktl, 2),
    rate: eur(table.rate.ktl),
    carrierM2: num(s.carrierSurfaceM2, 0),
    density: num(s.densitySteel, 2),
    utilisation: pct(s.utilisation, 0),
    minutes: num(s.minutesPerCarrier, 1),
    carriersPerHour: num(carriersPerHour, 2),
    ratePerCarrier: eur(carriersPerHour ? table.rate.ktl / carriersPerHour : null),
    wage: eur(s.wagePerHour, 2),
    paintDktl: eur(s.paintDktl, 3),
    paintNktl: eur(s.paintNktlFormula, 3),
    pretreatNormal: eur(s.pretreatNormal, 3),
    pretreatBeizen: eur(s.pretreatBeizen, 3),
    masking: eur(s.maskingPerPoint, 2),
    casting: pct(s.castingSurcharge, 0),
    overhead: pct(s.overhead, 0),
    etz: pct(s.etz),
    workingDaysYear: num(s.workingDaysPerYear),
    basePerCarrier: eur(s.basePerCarrier, 2),
    basePerPart: eur(s.basePerPart, 2),
    carriersTable: num(s.carriersPerHourTable),
    ratePerUnit: eur(table.ratePerUnit.ktl),
    variablePerUnit: eur(table.variablePerUnit.ktl),
    sumPerUnit: eur(table.sumPerUnit.ktl),
  };
};

const pulverVars = (s) => {
  const target = s.targetBase * s.targetFactor;
  return {
    targetBase: eur(s.targetBase, 2),
    targetFactor: pct(s.targetFactor, 0),
    target: eur(target, 2),
    usefulHours: num(s.usefulHoursPerShift, 1),
    perShift: eur(s.usefulHoursPerShift * target, 2),
    density: num(s.densitySteel, 2),
    gap: num(s.gapMetres, 2),
    speed: num(s.chainSpeed, 1),
    plug: eur(s.pricePerPlug, 2),
    tape: eur(s.pricePerTape, 2),
    layer: num(s.layerUm),
    powderDensity: num(s.powderDensity, 1),
    transfer: pct(s.transferEfficiency, 0),
    etz: pct(s.etz),
    materialShare: pct(s.materialShare, 0),
    machineRate: eur(s.machineRate, 2),
    workers: num(s.workers),
    wage: eur(s.wagePerHour, 2),
  };
};

// [{ key, title, rows: [{ cell, label, formula, strong, info }] }]
export const formulaSections = (process, settings, table, t) => {
  const isKtl = process === "ktl";
  const layout = isKtl ? KTL_LAYOUT : PULVER_LAYOUT;
  const vars = isKtl ? ktlVars(settings, table) : pulverVars(settings);
  const base = `settings.formulas.${isKtl ? "ktl" : "pulver"}`;
  return layout.map(([section, cells]) => ({
    key: section,
    title: t(`${base}.sections.${section}`),
    rows: cells.map((entry) => {
      const [cell, mark] = Array.isArray(entry) ? entry : [entry, null];
      const [label, formula] = t(`${base}.rows.${cell}`);
      return { cell, label, formula: fill(formula, vars), strong: mark === "strong", info: mark === "info" };
    }),
  }));
};
