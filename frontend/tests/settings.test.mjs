// Settings kept in the browser can be old or damaged - they must be
// repaired value by value, never break the calculation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { settingsOf } from "../src/components/OfferBuilder/state/useOfferStore.js";
import { DEFAULT_SETTINGS } from "../src/components/OfferBuilder/engine/defaults.js";
import { calcKtl } from "../src/components/OfferBuilder/engine/ktl.js";
import { calcPulver } from "../src/components/OfferBuilder/engine/pulver.js";

test("missing or damaged settings fall back to the Excel defaults, good ones are kept", () => {
  const s = settingsOf({
    ktl: { overhead: 0.2, fixedCosts: null, variableCosts: "x", minutesPerCarrier: "8", etz: NaN },
    pulver: { chainSpeed: 3, gapMetres: Infinity },
  });
  assert.equal(s.ktl.overhead, 0.2, "a valid edit is kept");
  assert.deepEqual(s.ktl.fixedCosts, DEFAULT_SETTINGS.ktl.fixedCosts);
  assert.deepEqual(s.ktl.variableCosts, DEFAULT_SETTINGS.ktl.variableCosts);
  assert.equal(s.ktl.minutesPerCarrier, DEFAULT_SETTINGS.ktl.minutesPerCarrier, "text instead of a number");
  assert.equal(s.ktl.etz, DEFAULT_SETTINGS.ktl.etz, "NaN");
  assert.equal(s.pulver.chainSpeed, 3);
  assert.equal(s.pulver.gapMetres, DEFAULT_SETTINGS.pulver.gapMetres, "Infinity");
  for (const broken of [null, undefined, "text", 5, [], {}]) {
    const all = settingsOf(broken);
    assert.deepEqual(all, { ktl: DEFAULT_SETTINGS.ktl, pulver: DEFAULT_SETTINGS.pulver });
  }
});

test("repaired settings always calculate", () => {
  const s = settingsOf({ ktl: { fixedCosts: [{}], variableCosts: [] } });
  assert.doesNotThrow(() => calcKtl({ quantity: "1000", surfaceMm2: "50000", loadMinutes: "5", workers: "1" }, s.ktl));
  assert.doesNotThrow(() => calcPulver({ partLengthM: "1", partsPerHook: "1" }, s.pulver));
});
