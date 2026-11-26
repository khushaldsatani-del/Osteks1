// Load: the calculation runs on every key press for every part of the
// offer, so it has to stay far below a frame (16 ms) even for big offers.
// Limits are generous (slow office PCs); the measured numbers are printed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcKtl } from "../src/components/OfferBuilder/engine/ktl.js";
import { calcPulver } from "../src/components/OfferBuilder/engine/pulver.js";
import { DEFAULT_SETTINGS } from "../src/components/OfferBuilder/engine/defaults.js";
import { emptyKtlPart, initialState, reducer } from "../src/components/OfferBuilder/state/offerState.js";
import { docPreviewInput } from "../src/components/OfferBuilder/letters/offerLetter.js";
import { makeT } from "../src/components/OfferBuilder/i18n/offerT.js";

const time = (fn) => {
  const start = performance.now();
  fn();
  return performance.now() - start;
};

test("100,000 KTL and 100,000 Powder calculations", () => {
  const ktl = { quantity: "10000", surfaceMm2: "63694", weightG: "500", thicknessMm: "2", loadMinutes: "10", workers: "2", beizen: true };
  const pulver = { quantity: "5000", surfaceCm2: "2000", powderPricePerKg: "12", partLengthM: "0.4", partsPerHook: "2" };
  const ktlMs = time(() => {
    for (let i = 0; i < 100_000; i += 1) calcKtl({ ...ktl, quantity: String(1000 + i) }, DEFAULT_SETTINGS.ktl);
  });
  const pulverMs = time(() => {
    for (let i = 0; i < 100_000; i += 1) calcPulver({ ...pulver, quantity: String(1000 + i) }, DEFAULT_SETTINGS.pulver);
  });
  console.log(`  KTL: ${(ktlMs / 100).toFixed(4)} ms per 1000 calculations; Powder: ${(pulverMs / 100).toFixed(4)} ms per 1000`);
  assert.ok(ktlMs / 100_000 < 0.2, `KTL ${ktlMs / 100_000} ms per calculation`);
  assert.ok(pulverMs / 100_000 < 0.2, `Powder ${pulverMs / 100_000} ms per calculation`);
});

test("an offer with 500 parts: adding, editing and building the letter stay fast", () => {
  let state = initialState();
  const addMs = time(() => {
    for (let i = 0; i < 499; i += 1) state = reducer(state, { type: "addPart", part: { ...emptyKtlPart(), name: `Teil ${i}`, quantity: "1000", surfaceMm2: "50000", loadMinutes: "5", workers: "1" } });
  });
  const parts = state.offers.ktl.parts;
  assert.equal(parts.length, 500);
  // one key press = one part update + every part recalculated (what the page does)
  const target = parts[250].id;
  const keyMs = time(() => {
    state = reducer(state, { type: "part", id: target, changes: { quantity: "2000" } });
    Object.fromEntries(state.offers.ktl.parts.map((p) => [p.id, calcKtl(p, state.settings.ktl)]));
  });
  const results = Object.fromEntries(state.offers.ktl.parts.map((p) => [p.id, calcKtl(p, state.settings.ktl)]));
  const letterMs = time(() => docPreviewInput("ktl", state.offers.ktl, results, "de", makeT("de")));
  console.log(`  500 parts: add all ${addMs.toFixed(1)} ms, one key press ${keyMs.toFixed(2)} ms, letter data ${letterMs.toFixed(2)} ms`);
  assert.ok(keyMs < 50, `a key press with 500 parts took ${keyMs} ms`);
  assert.ok(letterMs < 200, `letter data for 500 parts took ${letterMs} ms`);
});
