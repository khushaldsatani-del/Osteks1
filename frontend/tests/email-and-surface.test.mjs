// Quantities from the enquiry email go to the right part (never a guess),
// and the surface fills itself from weight and thickness without touching
// a typed or stored surface.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyKtlPart, emptyPulverPart, initialState, normalizeOffer, reducer } from "../src/components/OfferBuilder/state/offerState.js";
import { matchEmailQuantities, sameNumber } from "../src/components/OfferBuilder/state/emailQuantities.js";
import { surfaceFromWeight } from "../src/components/OfferBuilder/state/autoSurface.js";
import { calcKtl } from "../src/components/OfferBuilder/engine/ktl.js";
import { calcPulver } from "../src/components/OfferBuilder/engine/pulver.js";
import { DEFAULT_SETTINGS } from "../src/components/OfferBuilder/engine/defaults.js";

const part = (fields) => ({ ...emptyKtlPart(), ...fields });

test("drawing numbers match across spaces, dashes and a revision letter - not a shorter number", () => {
  assert.ok(sameNumber("5Q0 802 123 A", "5Q0-802-123-A"));
  assert.ok(sameNumber("5Q0802123", "5Q0802123A"));
  assert.ok(!sameNumber("123", "5Q0802123"));
  assert.ok(!sameNumber("T03960", "T03961"));
  assert.ok(!sameNumber("", ""));
});

test("2-3 parts in one email: each quantity goes to its own part", () => {
  const a = part({ name: "Halter links", drawingNo: "5Q0 802 123 A" });
  const b = part({ name: "Halter rechts", drawingNo: "5Q0 802 124 A" });
  const c = part({ name: "Deckel", drawingNo: "" });
  const found = matchEmailQuantities([a, b, c], [
    { name: "Halter rechts", drawingNo: "5Q0802124A", quantity: 8000 },
    { name: "Halter links", drawingNo: "5Q0-802-123-A", quantity: 12000 },
    { name: "Deckel", drawingNo: "", quantity: 500 },
  ]);
  assert.equal(found.get(a.id), 12000);
  assert.equal(found.get(b.id), 8000);
  assert.equal(found.get(c.id), 500);
});

test("unclear quantities are left out instead of guessed", () => {
  const a = part({ name: "Halter", drawingNo: "A-1000" });
  const b = part({ name: "Halter", drawingNo: "A-2000" });
  // name only, and two parts share it
  assert.equal(matchEmailQuantities([a, b], [{ name: "Halter", drawingNo: "", quantity: 100 }]).size, 0);
  // a number nobody has
  assert.equal(matchEmailQuantities([a, b], [{ name: "", drawingNo: "B-9999", quantity: 100 }]).size, 0);
  // two different quantities for the same part
  assert.equal(matchEmailQuantities([a], [{ name: "", drawingNo: "A-1000", quantity: 100 }, { name: "Halter", drawingNo: "A1000", quantity: 200 }]).size, 0);
  // no quantity
  assert.equal(matchEmailQuantities([a], [{ name: "Halter", drawingNo: "A-1000", quantity: 0 }]).size, 0);
});

test("one drawing and one quantity: it is that part's, unless the numbers differ", () => {
  const a = part({ name: "Halter", drawingNo: "A-1000" });
  assert.equal(matchEmailQuantities([a], [{ name: "Bracket", drawingNo: "", quantity: 300 }], { single: true }).get(a.id), 300);
  assert.equal(matchEmailQuantities([a], [{ name: "", drawingNo: "B-2000", quantity: 300 }], { single: true }).size, 0);
  // without `single` (several drawings) a name that does not match gets nothing
  assert.equal(matchEmailQuantities([a], [{ name: "Bracket", drawingNo: "", quantity: 300 }]).size, 0);
});

test("the reducer fills only empty quantities, in KTL and Powder", () => {
  let s = initialState();
  const first = s.offers.ktl.parts[0];
  s = reducer(s, { type: "part", id: first.id, changes: { drawingNo: "A-1000", quantity: "50" } });
  s = reducer(s, { type: "addPart", part: part({ drawingNo: "A-2000" }) });
  s = reducer(s, { type: "emailQuantities", process: "ktl", quantities: [{ name: "", drawingNo: "A-1000", quantity: 999 }, { name: "", drawingNo: "A-2000", quantity: 777 }] });
  assert.equal(s.offers.ktl.parts[0].quantity, "50"); // typed - kept
  assert.equal(s.offers.ktl.parts[1].quantity, "777");

  s = reducer(s, { type: "process", process: "pulver" });
  const powder = s.offers.pulver.parts[0];
  s = reducer(s, { type: "part", id: powder.id, changes: { customerArticleNo: "P-7700" } });
  s = reducer(s, { type: "emailQuantities", process: "pulver", quantities: [{ name: "", drawingNo: "P 7700", quantity: 4000 }] });
  assert.equal(s.offers.pulver.parts[0].quantity, "4000");
});

test("KTL surface fills itself from weight and thickness and follows them", () => {
  let s = initialState();
  const id = s.offers.ktl.parts[0].id;
  s = reducer(s, { type: "part", id, changes: { weightG: "500", thicknessMm: "2" } });
  const expected = String(Math.round(calcKtl({ ...emptyKtlPart(), weightG: "500", thicknessMm: "2" }, DEFAULT_SETTINGS.ktl).areaFromWeight));
  assert.equal(s.offers.ktl.parts[0].surfaceMm2, expected);
  assert.equal(s.offers.ktl.parts[0].surfaceAuto, true);

  s = reducer(s, { type: "part", id, changes: { thicknessMm: "1" } });
  assert.equal(s.offers.ktl.parts[0].surfaceMm2, surfaceFromWeight("ktl", { weightG: "500", thicknessMm: "1" }, DEFAULT_SETTINGS.ktl));
  assert.ok(Math.abs(Number(s.offers.ktl.parts[0].surfaceMm2) - 2 * Number(expected)) <= 1);

  s = reducer(s, { type: "part", id, changes: { weightG: "" } });
  assert.equal(s.offers.ktl.parts[0].surfaceMm2, "");
});

test("a typed surface (or one read from the drawing) is never overwritten", () => {
  let s = initialState();
  const id = s.offers.ktl.parts[0].id;
  s = reducer(s, { type: "part", id, changes: { surfaceMm2: "12345", weightG: "500", thicknessMm: "2" } });
  assert.equal(s.offers.ktl.parts[0].surfaceMm2, "12345");
  s = reducer(s, { type: "part", id, changes: { weightG: "800" } });
  assert.equal(s.offers.ktl.parts[0].surfaceMm2, "12345");
  // "Use from weight" switches it back to following the weight
  s = reducer(s, { type: "part", id, changes: { surfaceMm2: surfaceFromWeight("ktl", s.offers.ktl.parts[0], DEFAULT_SETTINGS.ktl), surfaceAuto: true } });
  s = reducer(s, { type: "part", id, changes: { weightG: "400" } });
  assert.equal(s.offers.ktl.parts[0].surfaceMm2, surfaceFromWeight("ktl", { weightG: "400", thicknessMm: "2" }, DEFAULT_SETTINGS.ktl));
});

test("a stored offer keeps its surface", () => {
  const stored = normalizeOffer("ktl", { parts: [{ ...emptyKtlPart(), surfaceMm2: "40000", weightG: "500", thicknessMm: "2" }] });
  let s = reducer(initialState(), { type: "load", process: "ktl", offer: stored });
  const id = s.offers.ktl.parts[0].id;
  s = reducer(s, { type: "part", id, changes: { name: "edited" } });
  assert.equal(s.offers.ktl.parts[0].surfaceMm2, "40000");
});

test("Powder surface in cm² from weight, thickness and material", () => {
  let s = reducer(initialState(), { type: "process", process: "pulver" });
  const id = s.offers.pulver.parts[0].id;
  s = reducer(s, { type: "part", id, changes: { weightG: "500", thicknessMm: "2", material: "steel" } });
  const steel = s.offers.pulver.parts[0].surfaceCm2;
  assert.equal(steel, String(Math.round(calcPulver({ ...emptyPulverPart(), weightG: "500", thicknessMm: "2", material: "steel" }, DEFAULT_SETTINGS.pulver).areaFromWeight / 100)));
  s = reducer(s, { type: "part", id, changes: { material: "aluminium" } });
  assert.ok(Number(s.offers.pulver.parts[0].surfaceCm2) > Number(steel), "aluminium is lighter, so the same weight is more surface");
});

test("a new steel density moves the automatic surfaces only", () => {
  let s = initialState();
  const auto = s.offers.ktl.parts[0].id;
  s = reducer(s, { type: "part", id: auto, changes: { weightG: "500", thicknessMm: "2" } });
  s = reducer(s, { type: "addPart", part: part({ surfaceMm2: "999", weightG: "500", thicknessMm: "2" }) });
  const before = s.offers.ktl.parts[0].surfaceMm2;
  s = reducer(s, { type: "settings", process: "ktl", changes: { densitySteel: DEFAULT_SETTINGS.ktl.densitySteel * 2 } });
  assert.equal(s.offers.ktl.parts[0].surfaceMm2, String(Math.round(Number(before) / 2)));
  assert.equal(s.offers.ktl.parts[1].surfaceMm2, "999");
});
