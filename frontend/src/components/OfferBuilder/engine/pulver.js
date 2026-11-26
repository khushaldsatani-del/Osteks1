// Pulver calculation, 1:1 the "_Kalkulation Pulverbeschichtung mit Material
// incl" sheet. Results carry their cell; #DIV/0! is null.

import { numOr, parseNum as num } from "./format";
import { densityOf } from "./defaults";
const div = (a, b) => (a == null || b == null || b === 0 ? null : a / b);
const add = (...xs) => (xs.some((x) => x == null) ? null : xs.reduce((s, x) => s + x, 0));

export function calcPulver(p, s) {
  const qty = num(p.quantity); // B10
  const weightG = num(p.weightG); // B14
  const thickness = num(p.thicknessMm); // B15
  const layer = numOr(p.layerUm, s.layerUm); // B19
  const areaCm2 = num(p.surfaceCm2); // B20
  const powderPrice = num(p.powderPricePerKg); // B21
  const length = num(p.partLengthM); // B23
  const perHook = num(p.partsPerHook); // B24
  const gap = numOr(p.gapMetres, s.gapMetres); // D24
  const speed = numOr(p.chainSpeed, s.chainSpeed); // B26
  const plugs = num(p.plugs); // B30
  const tapes = num(p.tapes); // B31
  const etz = numOr(p.etz, s.etz); // B36
  const offerPrice = num(p.offerPrice); // B40
  const density = densityOf(p.material, s.densitySteel); // B16 - steel unless another material is chosen
  const workers = numOr(p.workers, s.workers); // H18
  const wage = numOr(p.wagePerHour, s.wagePerHour); // H19

  const areaFromWeight = div(weightG * 2000, thickness * density); // B17
  // B25 = D25 = 1 / (part length + gap), exactly as the sheet: all
  // decimals count (0.0641 for a 15 m part), the form only shows two
  // (0.06). Rounding was tried and dropped - for long parts it moved the
  // price by several per cent away from the Excel.
  const hooksPerMetre = div(1, length + gap); // D25 / B25
  const target = s.targetBase * s.targetFactor; // H23
  const perHour = target; // H8
  const perShift = s.usefulHoursPerShift * perHour; // H7
  const partsPerHour = hooksPerMetre == null ? null : speed * 60 * hooksPerMetre * perHook; // H10
  const runtimeMinutes = div(qty * 60, partsPerHour); // H11
  const priceWithoutMaterial = div(perHour, partsPerHour); // B29
  const extras = s.pricePerPlug * plugs + s.pricePerTape * tapes;
  const priceBeforeMaterial = add(priceWithoutMaterial, extras); // B33
  // a transfer efficiency of 0 in the settings would divide by zero
  const gramsPerPart = div(areaCm2 * layer * s.powderDensity, s.transferEfficiency * 10000) ?? 0; // H27
  const materialCost = (gramsPerPart * powderPrice) / 1000; // H28 = B34
  const priceWithMaterial = add(priceBeforeMaterial, materialCost); // B35

  // What still has to be entered before there is a price (the sheet shows
  // #DIV/0!), what is entered but probably wrong (no powder cost without a
  // surface and a powder price - the sheet prices it anyway), and what
  // cannot be right: a negative value or no chain speed.
  const missing = [
    ["partLengthM", length],
    ["partsPerHook", perHook],
  ]
    .filter(([, value]) => value === 0)
    .map(([key]) => key);
  const warnings = [
    ["surfaceCm2", areaCm2],
    ["powderPricePerKg", powderPrice],
  ]
    .filter(([, value]) => value === 0)
    .map(([key]) => key);
  const invalid = [
    ["quantity", qty],
    ["weightG", weightG],
    ["thicknessMm", thickness],
    ["surfaceCm2", areaCm2],
    ["powderPricePerKg", powderPrice],
    ["partLengthM", length],
    ["partsPerHook", perHook],
    ["plugs", plugs],
    ["tapes", tapes],
    ["gapMetres", gap],
    ["layerUm", layer],
    ["workers", workers],
    ["wagePerHour", wage],
    ["etz", etz],
  ]
    .filter(([, value]) => value < 0)
    .map(([key]) => key);
  if (!(speed > 0)) invalid.push("chainSpeed");
  const priced = missing.length === 0 && invalid.length === 0;
  const price = priced && priceWithMaterial != null ? priceWithMaterial * (1 + etz) : null; // B37

  return {
    areaFromWeight,
    areaMm2: areaCm2 * 100, // D20
    hooksPerMetre,
    target,
    perShift,
    partsPerHour,
    runtimeMinutes,
    revenueForQty: priceWithoutMaterial == null ? null : qty * priceWithoutMaterial, // H12 = B10*B29
    machinePerPart: div(s.machineRate, partsPerHour), // H17
    density,
    workers,
    wage,
    layer,
    speed,
    missing,
    warnings,
    invalid,
    priceWithoutMaterial, // B29
    priceBeforeMaterial, // B33
    materialCost, // B34
    priceWithMaterial, // B35
    wagePerPart: div(wage * workers, partsPerHour), // H20
    gramsPerPart,
    materialPerShiftKg: partsPerHour == null ? null : (gramsPerPart * partsPerHour * s.usefulHoursPerShift) / 1000, // H30
    rows: [
      { key: "withoutMaterial", cell: "B29", value: priceWithoutMaterial },
      { key: "plugs", cell: "E30×B30", value: s.pricePerPlug * plugs },
      { key: "tapes", cell: "E31×B31", value: s.pricePerTape * tapes },
      { key: "beforeMaterial", cell: "B33", value: priceBeforeMaterial, strong: true },
      { key: "material", cell: "B34", value: materialCost },
      { key: "withMaterial", cell: "B35", value: priceWithMaterial, strong: true },
      { key: "etz", cell: "B36", value: priceWithMaterial == null ? null : priceWithMaterial * etz },
    ],
    materialShare: div(materialCost, priceWithMaterial), // D35
    price,
    etz,
    offerPrice,
    calculatedPrice: price,
  };
}
