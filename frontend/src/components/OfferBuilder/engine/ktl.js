// KTL calculation, 1:1 the "_Kalkulationsschema KTL incl ETZ" sheet. Every
// result carries the cell it stands for. A value Excel would show as
// #DIV/0! is null here; the UI shows it as "–".

import { numOr, parseNum as num } from "./format";
const div = (a, b) => (a == null || b == null || b === 0 ? null : a / b);
const add = (...xs) => (xs.some((x) => x == null) ? null : xs.reduce((s, x) => s + x, 0));
const mul = (...xs) => (xs.some((x) => x == null) ? null : xs.reduce((s, x) => s * x, 1));

// The machine-hour rate block (columns I-AD): yearly costs per line, hours
// per year, rate per hour, per carrier / per metre of chain.
export function costTable(s) {
  const fixed = s.fixedCosts.map((c) => {
    const schaeumen = 1 - c.pulver - c.ktl; // Q = 1-O-M
    return { ...c, schaeumen, ktlEur: c.amount * c.ktl, pulverEur: c.amount * c.pulver, schaeumenEur: c.amount * schaeumen };
  });
  const sum = (key) => fixed.reduce((t, c) => t + c[key], 0);
  const onePerYear = s.hoursPerShift * s.workingDays * s.availability; // T9
  const hours = { ktl: onePerYear * s.shiftsKtl, pulver: onePerYear * s.shiftsPulver, schaeumen: onePerYear * s.shiftsSchaeumen };
  const totals = { all: sum("amount"), ktl: sum("ktlEur"), pulver: sum("pulverEur"), schaeumen: sum("schaeumenEur") }; // J20, L20, N20, P20
  const rate = { ktl: totals.ktl / hours.ktl, pulver: totals.pulver / hours.pulver, schaeumen: totals.schaeumen / hours.schaeumen }; // L22, N22, P22

  // variable costs (Y-AD): per year, per hour, per carrier / metre
  const variable = s.variableCosts.map((c) => {
    const ktlYear = c.amount * c.ktl; // Y6
    const pulverYear = c.amount * c.pulver; // AA6
    const schaeumenYear = c.amount * c.schaeumen; // AC6
    const ktlHour = ktlYear / hours.ktl; // Y12 = Y6/$T$11
    const pulverHour = pulverYear / (onePerYear * 2); // AA12 = AA6/$T$10
    const schaeumenHour = schaeumenYear / (onePerYear * 2); // AC12 = AC6/$T$10
    return {
      ...c,
      ktlYear,
      pulverYear,
      schaeumenYear,
      ktlHour,
      pulverHour,
      schaeumenHour,
      ktlPerUnit: ktlHour / s.carriersPerHourTable, // Y18 = Y12/$T$13
      pulverPerUnit: pulverHour / s.chainMetresPerHour, // AA18 = AA12/$T$14
      schaeumenPerUnit: schaeumenHour / (onePerYear * 2), // AC18 = AC12/$T$10
    };
  });
  const varSum = (key) => variable.reduce((t, c) => t + c[key], 0);
  const variablePerUnit = { ktl: varSum("ktlPerUnit"), pulver: varSum("pulverPerUnit") }; // Y22, AA22

  const ratePerUnit = { ktl: rate.ktl / s.carriersPerHourTable, pulver: rate.pulver / s.chainMetresPerHour }; // L25, N25
  return {
    fixed,
    totals,
    hours,
    onePerYear,
    rate,
    variable,
    variablePerUnit,
    ratePerUnit,
    sumPerUnit: { ktl: ratePerUnit.ktl + variablePerUnit.ktl, pulver: ratePerUnit.pulver + variablePerUnit.pulver }, // L27, N27
  };
}

// The cost table depends only on the settings, not on the part - built
// once per settings object (the state replaces that object on every
// change, so a cached table is never out of date) instead of once per
// part on every key press.
const tableCache = new WeakMap();
const cachedTable = (s) => {
  let table = tableCache.get(s);
  if (!table) {
    table = costTable(s);
    tableCache.set(s, table);
  }
  return table;
};

// B16: the surface (mm²) a steel sheet part of this weight and thickness
// has - also what fills the surface field by itself (state/autoSurface.js).
export const ktlAreaFromWeight = (p, s) => div(num(p.weightG) * 2000, num(p.thicknessMm) * s.densitySteel);

// One part. `p` is the part's inputs (B2 ... F5), `s` the KTL settings.
export function calcKtl(p, s) {
  const table = cachedTable(s);
  const qty = num(p.quantity); // B2
  const areaMm2 = num(p.surfaceMm2); // B3
  const weightG = num(p.weightG); // B4
  const carrierM2 = numOr(p.carrierSurfaceM2, s.carrierSurfaceM2); // B6
  const beizen = p.beizen ? "j" : "n"; // B8
  const guss = p.guss ? "j" : "n"; // B9
  const masking = num(p.maskingPoints); // B10
  const loadMinutes = num(p.loadMinutes); // B11
  const workers = num(p.workers); // B12
  const wage = numOr(p.wagePerHour, s.wagePerHour); // B13
  const thickness = num(p.thicknessMm); // B14
  const etz = numOr(p.etz, s.etz); // B30
  const offerPrice = num(p.offerPrice); // B34
  const minutesPerCarrier = numOr(p.minutesPerCarrier, s.minutesPerCarrier); // F4
  const utilisation = numOr(p.utilisation, s.utilisation); // F5
  const paint = p.paint === "N-KTL" ? "N-KTL" : "D-KTL"; // E21

  const areaM2 = areaMm2 / 1_000_000; // C3
  const fit = areaMm2 ? Math.floor((carrierM2 * 100 * 100 * 100) / areaMm2) : null;
  const partsPerCarrier = fit == null ? null : fit > qty ? qty : fit; // B7
  const areaFromWeight = ktlAreaFromWeight(p, s); // B16

  // --- old calculation (column B) ---
  const basePrice = partsPerCarrier ? s.basePerCarrier / partsPerCarrier + s.basePerPart : null; // B25
  const pickling = beizen === "j" ? (s.paintDktl * areaMm2) / 1_000_000 : 0; // B26 (uses H2!)
  const maskingCost = s.maskingPerPoint * masking; // B27
  const casting = guss === "j" ? mul(add(basePrice, pickling), s.castingSurcharge) : 0; // B28
  const sum = add(basePrice, pickling, maskingCost, casting); // B29

  // --- Parallelkalkulation nach Maschinenstundensatz (column F) ---
  // F4 = 0 is #DIV/0! in the sheet: no carriers per hour, no machine cost
  // (a plain 60 / 0 would make the machine cost silently 0 €)
  const piecesPerHour = partsPerCarrier == null ? null : div(partsPerCarrier * 60 * utilisation, minutesPerCarrier); // F6
  const machineRate = table.rate.ktl; // F8 = L22
  const carriersPerHour = div(60, minutesPerCarrier); // F9
  const machinePerCarrier = div(machineRate, carriersPerHour); // F10
  const staffPerCarrier = (loadMinutes * workers * wage) / 60; // F11
  // F21 has 0.395 / 0.29 typed in; both are editable settings here
  const paintCost = paint === "D-KTL" ? s.paintDktl * areaM2 : s.paintNktlFormula * areaM2; // F21
  const pretreatKind = beizen === "j" ? "Beizen" : "Normal"; // E22
  const pretreatCost = pretreatKind === "Normal" ? s.pretreatNormal * areaM2 : s.pretreatBeizen * areaM2; // F22
  const material = paintCost + pretreatCost; // F23
  const machineCost = div(machinePerCarrier, partsPerCarrier); // F26
  const staffCost = div(staffPerCarrier, partsPerCarrier); // F27
  const overheadCost = mul(add(material, machineCost, staffCost), s.overhead); // F28
  const newSum = add(material, maskingCost, casting, machineCost, staffCost, overheadCost); // F29
  const newEtz = mul(newSum, etz); // F30
  const hasStaff = staffCost != null && staffCost > 0;

  // What still has to be entered before there is a price (the sheet then
  // shows "keine Personalkosten" / #DIV/0!), and what cannot be right: a
  // negative value anywhere, or no time per carrier. Both are named per
  // field, so the form can point at them; either one means no price.
  const missing = [
    ["surfaceMm2", areaMm2],
    ["quantity", qty],
    ["loadMinutes", loadMinutes],
    ["workers", workers],
    ["wagePerHour", wage],
  ]
    .filter(([, value]) => value === 0)
    .map(([key]) => key);
  const invalid = [
    ["quantity", qty],
    ["surfaceMm2", areaMm2],
    ["weightG", weightG],
    ["thicknessMm", thickness],
    ["maskingPoints", masking],
    ["loadMinutes", loadMinutes],
    ["workers", workers],
    ["wagePerHour", wage],
    ["utilisation", utilisation],
    ["carrierSurfaceM2", carrierM2],
    ["etz", etz],
  ]
    .filter(([, value]) => value < 0)
    .map(([key]) => key);
  if (!(minutesPerCarrier > 0)) invalid.push("minutesPerCarrier");
  if (!(carrierM2 > 0) && !invalid.includes("carrierSurfaceM2")) invalid.push("carrierSurfaceM2");
  const priced = hasStaff && missing.length === 0 && invalid.length === 0;

  const oldPrice = priced ? mul(sum, 1 + etz) : null; // B32
  const newPrice = priced ? add(newSum, newEtz) : null; // F32
  const share = (v) => (newPrice ? div(v, newPrice) : null); // column G

  return {
    table,
    areaM2,
    partsPerCarrier,
    areaFromWeight,
    weightPerCarrier: partsPerCarrier == null ? null : (partsPerCarrier * weightG) / 1000, // B20
    // B21 / B22 exactly as the sheet: from the old calculation's sum (B29),
    // not from the machine-hour price (decided after comparing with Excel).
    // B23 uses the price the letter uses (typed offer price, else the
    // calculated price rounded to cents) - with an offer price typed it is
    // the sheet's B34 x B2.
    revenuePerCarrier: mul(partsPerCarrier, sum), // B21 = B7 x B29
    revenuePerM2: areaMm2 > 1 && sum != null ? (sum * 1_000_000) / areaMm2 : 0, // B22 = B29 x 1,000,000 / B3
    revenuePerYear: (offerPrice > 0 ? offerPrice : newPrice == null ? 0 : Math.round(newPrice * 100) / 100) * qty, // B23
    old: { basePrice, pickling, maskingCost, casting, sum, price: oldPrice, etz },
    machine: {
      partsPerCarrier,
      minutesPerCarrier,
      utilisation,
      piecesPerHour,
      machineRate,
      carriersPerHour,
      machinePerCarrier,
      staffPerCarrier,
      paint,
      pretreatKind,
      rows: [
        { key: "paint", cell: "F21", value: paintCost, share: share(paintCost) },
        { key: "pretreat", cell: "F22", value: pretreatCost, share: share(pretreatCost) },
        { key: "material", cell: "F23", value: material, share: share(material), strong: true },
        { key: "masking", cell: "F24", value: maskingCost, share: share(maskingCost) },
        { key: "casting", cell: "F25", value: casting, share: share(casting) },
        { key: "machine", cell: "F26", value: machineCost, share: share(machineCost) },
        { key: "staff", cell: "F27", value: staffCost, share: share(staffCost) },
        { key: "overhead", cell: "F28", value: overheadCost, share: share(overheadCost) },
        { key: "sum", cell: "F29", value: newSum, share: share(newSum), strong: true },
        { key: "etz", cell: "F30", value: newEtz, share: share(newEtz) },
      ],
      price: newPrice,
      carriersPerDay: div(qty, s.workingDaysPerYear * (partsPerCarrier ?? 0)), // F33
      carriersPerYear: div(qty, partsPerCarrier), // F34
    },
    hasStaff,
    missing,
    invalid,
    // the price the offer starts from: the machine-hour result
    calculatedPrice: newPrice,
  };
}
