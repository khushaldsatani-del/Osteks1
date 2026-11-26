// The KTL and Powder engines against Microsoft Excel itself: 25 random
// parts per process, recalculated by Excel from the real sheets
// (fixtures/excel-reference.json). Every compared cell must match to
// 1e-9 (relative) - the same formulas, not "close enough".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcKtl } from "../src/components/OfferBuilder/engine/ktl.js";
import { calcPulver } from "../src/components/OfferBuilder/engine/pulver.js";
import { DEFAULT_SETTINGS } from "../src/components/OfferBuilder/engine/defaults.js";

const reference = JSON.parse(readFileSync(new URL("./fixtures/excel-reference.json", import.meta.url), "utf8"));

const close = (actual, expected, label) => {
  if (expected === null) {
    assert.equal(actual ?? null, null, `${label}: Excel shows an error (#DIV/0!), the app must show no value`);
    return;
  }
  assert.ok(Number.isFinite(actual), `${label}: expected ${expected}, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${label}: app ${actual} vs Excel ${expected}`);
};

reference.ktl.forEach(({ input: x, excel: e }, i) => {
  test(`KTL part ${i + 1} matches Excel`, () => {
    const part = {
      quantity: String(x.B2),
      surfaceMm2: String(x.B3),
      weightG: String(x.B4),
      thicknessMm: String(x.B14),
      beizen: x.B8 === "j",
      guss: x.B9 === "j",
      maskingPoints: String(x.B10),
      paint: x.E21,
      loadMinutes: String(x.B11),
      workers: String(x.B12),
    };
    const r = calcKtl(part, DEFAULT_SETTINGS.ktl);
    const m = r.machine;
    const row = (key) => m.rows.find((rw) => rw.key === key).value;
    const app = {
      C3: r.areaM2,
      B7: r.partsPerCarrier,
      B16: r.areaFromWeight,
      F6: m.piecesPerHour,
      F10: m.machinePerCarrier,
      F11: m.staffPerCarrier,
      F21: row("paint"),
      F22: row("pretreat"),
      F23: row("material"),
      F24: row("masking"),
      F25: row("casting"),
      F26: row("machine"),
      F27: row("staff"),
      F28: row("overhead"),
      F29: row("sum"),
      F30: row("etz"),
      F32: m.price,
      F33: m.carriersPerDay,
      F34: m.carriersPerYear,
      B20: r.weightPerCarrier,
      B25: r.old.basePrice,
      B26: r.old.pickling,
      B27: r.old.maskingCost,
      B28: r.old.casting,
      B29: r.old.sum,
      B32: r.old.price,
    };
    for (const [cell, expected] of Object.entries(e)) close(app[cell], expected, cell);
  });
});

reference.pulver.forEach(({ input: x, excel: e }, i) => {
  test(`Powder part ${i + 1} matches Excel`, () => {
    const part = {
      quantity: String(x.B10),
      weightG: String(x.B14),
      thicknessMm: String(x.B15),
      surfaceCm2: String(x.B20),
      powderPricePerKg: String(x.B21),
      partLengthM: String(x.B23),
      partsPerHook: String(x.B24),
      plugs: String(x.B30),
      tapes: String(x.B31),
      material: "steel",
    };
    const r = calcPulver(part, DEFAULT_SETTINGS.pulver);
    const app = {
      B17: r.areaFromWeight,
      B25: r.hooksPerMetre,
      H7: r.perShift,
      H10: r.partsPerHour,
      H11: r.runtimeMinutes,
      H12: r.revenueForQty,
      H17: r.machinePerPart,
      H20: r.wagePerPart,
      H27: r.gramsPerPart,
      H28: r.materialCost,
      H30: r.materialPerShiftKg,
      B29: r.priceWithoutMaterial,
      B33: r.priceBeforeMaterial,
      B34: r.materialCost,
      B35: r.priceWithMaterial,
      B37: r.price,
      D35: r.materialShare,
    };
    for (const [cell, expected] of Object.entries(e)) close(app[cell], expected, cell);
  });
});
