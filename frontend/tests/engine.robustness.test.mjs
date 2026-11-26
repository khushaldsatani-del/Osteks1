// Trying to break the engines: empty, zero, negative, huge, text and
// malformed input must never produce NaN / Infinity, a negative price or
// a crash - and the result must say what is missing or wrong.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcKtl } from "../src/components/OfferBuilder/engine/ktl.js";
import { calcPulver } from "../src/components/OfferBuilder/engine/pulver.js";
import { DEFAULT_SETTINGS } from "../src/components/OfferBuilder/engine/defaults.js";
import { emptyKtlPart, emptyPulverPart } from "../src/components/OfferBuilder/state/offerState.js";

const KTL_OK = { ...emptyKtlPart(), quantity: "10000", surfaceMm2: "63694", weightG: "500", thicknessMm: "2", loadMinutes: "10", workers: "2" };
const PULVER_OK = { ...emptyPulverPart(), quantity: "5000", surfaceCm2: "2000", powderPricePerKg: "12", partLengthM: "0.4", partsPerHook: "2" };

// every number anywhere in the result is finite (or null / undefined)
const assertNoBrokenNumbers = (value, path = "result") => {
  if (typeof value === "number") assert.ok(Number.isFinite(value), `${path} is ${value}`);
  else if (Array.isArray(value)) value.forEach((v, i) => assertNoBrokenNumbers(v, `${path}[${i}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => assertNoBrokenNumbers(v, `${path}.${k}`));
};

const NASTY = ["", " ", "0", "-1", "-0", "abc", "1e400", "Infinity", "NaN", "12abc", "1,2,3", "999999999999999", "0.0000001", null, undefined, "<script>", "1.50.000", "1,50,000", "١٢٣"];

test("KTL: no NaN / Infinity / negative price for any nasty value in any field", () => {
  for (const field of [...Object.keys(KTL_OK).filter((k) => k !== "id"), "minutesPerCarrier", "wagePerHour", "utilisation", "carrierSurfaceM2", "etz"]) {
    for (const bad of NASTY) {
      const r = calcKtl({ ...KTL_OK, [field]: bad }, DEFAULT_SETTINGS.ktl);
      assertNoBrokenNumbers(r, `KTL ${field}=${JSON.stringify(bad)}`);
      if (r.calculatedPrice != null) assert.ok(r.calculatedPrice > 0, `KTL ${field}=${JSON.stringify(bad)} gave price ${r.calculatedPrice}`);
    }
  }
});

test("Powder: no NaN / Infinity / negative price for any nasty value in any field", () => {
  for (const field of [...Object.keys(PULVER_OK).filter((k) => k !== "id"), "chainSpeed", "gapMetres", "layerUm", "workers", "wagePerHour", "etz"]) {
    for (const bad of NASTY) {
      const r = calcPulver({ ...PULVER_OK, [field]: bad }, DEFAULT_SETTINGS.pulver);
      assertNoBrokenNumbers(r, `Powder ${field}=${JSON.stringify(bad)}`);
      if (r.calculatedPrice != null) assert.ok(r.calculatedPrice > 0, `Powder ${field}=${JSON.stringify(bad)} gave price ${r.calculatedPrice}`);
    }
  }
});

test("KTL: time per carrier 0 gives no price (Excel: #DIV/0!), not a price without machine cost", () => {
  const r = calcKtl({ ...KTL_OK, minutesPerCarrier: "0" }, DEFAULT_SETTINGS.ktl);
  assert.equal(r.calculatedPrice, null);
  assert.ok(r.invalid.includes("minutesPerCarrier"));
});

test("KTL: settings with time per carrier 0 give no price either", () => {
  const r = calcKtl(KTL_OK, { ...DEFAULT_SETTINGS.ktl, minutesPerCarrier: 0 });
  assert.equal(r.calculatedPrice, null);
});

test("KTL: a negative surface is rejected, not priced", () => {
  const r = calcKtl({ ...KTL_OK, surfaceMm2: "-63694" }, DEFAULT_SETTINGS.ktl);
  assert.equal(r.calculatedPrice, null);
  assert.deepEqual(r.invalid, ["surfaceMm2"]);
});

test("KTL: names exactly what is still missing", () => {
  const r = calcKtl({ ...emptyKtlPart() }, DEFAULT_SETTINGS.ktl);
  assert.deepEqual(r.missing, ["surfaceMm2", "quantity", "loadMinutes", "workers"]);
  const onlyQty = calcKtl({ ...KTL_OK, quantity: "" }, DEFAULT_SETTINGS.ktl);
  assert.deepEqual(onlyQty.missing, ["quantity"]);
  assert.equal(onlyQty.calculatedPrice, null);
  assert.deepEqual(calcKtl(KTL_OK, DEFAULT_SETTINGS.ktl).missing, []);
});

test("Powder: names what is missing; price needs part length and parts per hook", () => {
  const r = calcPulver({ ...emptyPulverPart() }, DEFAULT_SETTINGS.pulver);
  assert.deepEqual(r.missing, ["partLengthM", "partsPerHook"]);
  assert.equal(r.calculatedPrice, null);
  const noPowder = calcPulver({ ...PULVER_OK, powderPricePerKg: "" }, DEFAULT_SETTINGS.pulver);
  assert.ok(noPowder.calculatedPrice > 0, "a price without powder price is still the sheet's price");
  assert.deepEqual(noPowder.warnings, ["powderPricePerKg"]);
});

test("Powder: negative or zero chain speed / gap / length / hooks make no price", () => {
  for (const [field, value] of [["chainSpeed", "0"], ["chainSpeed", "-2.5"], ["gapMetres", "-0.4"], ["partLengthM", "-1"], ["partsPerHook", "-2"]]) {
    const r = calcPulver({ ...PULVER_OK, [field]: value }, DEFAULT_SETTINGS.pulver);
    assert.equal(r.calculatedPrice, null, `${field}=${value}`);
    assert.ok(r.invalid.includes(field), `${field}=${value} must be reported`);
  }
});

test("Powder: hooks per metre exactly as the sheet - the 45 m and 15 m parts give the Excel's prices", () => {
  const r = calcPulver(
    { ...emptyPulverPart(), quantity: "150000", weightG: "590", thicknessMm: "1", powderPricePerKg: "45", partLengthM: "45", partsPerHook: "25", plugs: "1", tapes: "5" },
    DEFAULT_SETTINGS.pulver
  );
  assert.ok(Math.abs(r.hooksPerMetre - 1 / 45.6) < 1e-12, "not rounded to 0.02");
  assert.ok(Math.abs(r.price - 7.9866192) < 1e-9, `45 m part: ${r.price}`);
  // the 15 m part from the user's Excel: 0.0641 hooks/m -> 12.5523 EUR
  const long = calcPulver(
    { ...emptyPulverPart(), quantity: "150000", weightG: "590", thicknessMm: "1", surfaceCm2: "150", powderPricePerKg: "15", partLengthM: "15", partsPerHook: "5", plugs: "1", tapes: "0" },
    DEFAULT_SETTINGS.pulver
  );
  assert.ok(Math.abs(long.priceWithoutMaterial - 9.8592) < 1e-9, `B29 ${long.priceWithoutMaterial}`);
  assert.ok(Math.abs(long.priceWithMaterial - 10.001831578947368) < 1e-9, `B35 ${long.priceWithMaterial}`);
  assert.ok(Math.abs(long.price - 12.552298631578947) < 1e-9, `B37 ${long.price}`);
});
