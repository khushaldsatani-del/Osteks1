// The offer state (every reducer action) and what goes into Document
// Preview for KTL and Powder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyKtlPart, emptyOffer, emptyPulverPart, initialState, isUntouchedPart, normalizeOffer, reducer } from "../src/components/OfferBuilder/state/offerState.js";
import { calcKtl } from "../src/components/OfferBuilder/engine/ktl.js";
import { calcPulver } from "../src/components/OfferBuilder/engine/pulver.js";
import { DEFAULT_SETTINGS } from "../src/components/OfferBuilder/engine/defaults.js";
import { docPreviewInput, isUsedPart } from "../src/components/OfferBuilder/letters/offerLetter.js";
import { makeT } from "../src/components/OfferBuilder/i18n/offerT.js";

const start = () => initialState();
const ktlParts = (s) => s.offers.ktl.parts;

test("adding, selecting, copying and removing parts", () => {
  let s = start();
  s = reducer(s, { type: "addPart" });
  assert.equal(ktlParts(s).length, 2);
  assert.equal(s.offers.ktl.selectedId, ktlParts(s)[1].id);

  const linked = ktlParts(s)[0].id;
  s = reducer(s, { type: "part", id: linked, changes: { name: "A", documentId: 7, extraction: { status: "success" } } });
  s = reducer(s, { type: "duplicatePart", id: linked, suffix: "(copy)" });
  const copy = ktlParts(s)[1];
  assert.equal(copy.name, "A (copy)");
  assert.equal(copy.documentId, undefined, "a copy is a new part without the drawing's record");
  assert.equal(copy.extraction, undefined);
  assert.notEqual(copy.id, linked);

  for (const p of [...ktlParts(s)]) s = reducer(s, { type: "removePart", id: p.id });
  assert.equal(ktlParts(s).length, 1, "removing the last part leaves one empty part");
  assert.ok(isUntouchedPart("ktl", ktlParts(s)[0]));
});

test("a part update finds the part in either process, also with a function", () => {
  let s = start();
  const pulverId = s.offers.pulver.parts[0].id;
  s = reducer(s, { type: "part", id: pulverId, changes: (p) => ({ name: `${p.name}x` }) });
  assert.equal(s.offers.pulver.parts[0].name, "x");
  assert.equal(s.process, "ktl");
});

test("load, offerIn, newOffer, settings", () => {
  let s = start();
  const offer = { ...emptyOffer("pulver"), offerNo: "1", documentId: 42 };
  s = reducer(s, { type: "load", process: "pulver", offer });
  assert.equal(s.process, "pulver");
  assert.equal(s.offers.pulver.documentId, 42);
  s = reducer(s, { type: "offerIn", process: "ktl", changes: { offerNo: "K" } });
  assert.equal(s.offers.ktl.offerNo, "K");
  s = reducer(s, { type: "settings", process: "ktl", changes: { overhead: 0.2 } });
  assert.equal(s.settings.ktl.overhead, 0.2);
  s = reducer(s, { type: "resetSettings", process: "ktl" });
  assert.equal(s.settings.ktl.overhead, DEFAULT_SETTINGS.ktl.overhead);
  s = reducer(s, { type: "newOffer" });
  assert.equal(s.offers.pulver.documentId, null);
  assert.equal(s.offers.ktl.offerNo, "");
});

test("unknown actions leave the state untouched", () => {
  const s = start();
  assert.equal(reducer(s, { type: "nonsense" }), s);
});

test("a broken or partial stored offer is repaired, never crashes the page", () => {
  for (const broken of [null, undefined, {}, { parts: [] }, { parts: null, customer: null }, { parts: [{}], texts: null }, "text", 5]) {
    const o = normalizeOffer("ktl", broken);
    assert.ok(Array.isArray(o.parts) && o.parts.length >= 1);
    assert.equal(typeof o.customer, "object");
    assert.equal(typeof o.customer.company, "string");
    assert.ok(o.parts.every((p) => typeof p.id === "string" && p.id));
    assert.equal(typeof o.texts, "object");
  }
  const typed = normalizeOffer("ktl", { parts: [{ id: "a", name: { broken: true }, quantity: ["x"], surfaceMm2: 500, beizen: "yes", workers: Infinity }] }).parts[0];
  assert.equal(typed.name, "", "an object as a name becomes empty text");
  assert.equal(typed.quantity, "", "a list as a quantity becomes empty text");
  assert.equal(typed.surfaceMm2, 500, "a number typed in a number box stays a number");
  assert.equal(typed.beizen, true, "a yes/no that is not true/false gets its default");
  assert.equal(typed.workers, "", "Infinity is not a number to keep");
  const kept = normalizeOffer("pulver", { ...emptyOffer("pulver"), offerNo: "9", parts: [{ ...emptyPulverPart(), name: "X" }] });
  assert.equal(kept.offerNo, "9");
  assert.equal(kept.parts[0].name, "X");
});

const tDe = makeT("de");

test("KTL letter: unedited texts stay Document Preview's own; rows per used part", () => {
  const part = { ...emptyKtlPart(), name: "Halter", drawingNo: "T1", paintSpec: "VW 13750", quantity: "10000", surfaceMm2: "63694", loadMinutes: "10", workers: "2", offerPrice: "0,30" };
  const unused = emptyKtlPart();
  const offer = { ...emptyOffer("ktl"), parts: [part, unused], customer: { company: "Firma", person: "Herr A", address: "Weg 1\n123 Ort" }, offerNo: "1-2" };
  const results = { [part.id]: calcKtl(part, DEFAULT_SETTINGS.ktl), [unused.id]: calcKtl(unused, DEFAULT_SETTINGS.ktl) };
  const input = docPreviewInput("ktl", offer, results, "de", tDe);
  assert.equal(input.contentOverrides, undefined);
  assert.equal(input.offerDetailsRowsList.length, 1, "the untouched part is left out");
  assert.deepEqual(Object.fromEntries(input.offerDetailsRowsList[0]), {
    teilebezeichnung: "Halter",
    zeichnungsnummer: "T1",
    lackiervorschrift: "VW 13750",
    schichtdicke: "15 - 25 µm",
    jahresmenge: "10.000",
    preisBeschichtung: "0,30 €",
  });
  assert.equal(input.firmaInfo.address, "Weg 1\n123 Ort");
  assert.ok(isUsedPart(part) && !isUsedPart(unused));
});

test("Powder letter: its own texts in Document Preview's layout, 14-day validity", () => {
  const part = { ...emptyPulverPart(), name: "Gehäuse", customerArticleNo: "C-1", quantity: "5000", surfaceCm2: "2000", powderPricePerKg: "12", partLengthM: "0.4", partsPerHook: "2" };
  const offer = { ...emptyOffer("pulver"), parts: [part], offerDate: "2026-11-26" };
  const input = docPreviewInput("pulver", offer, { [part.id]: calcPulver(part, DEFAULT_SETTINGS.pulver) }, "de", tDe);
  assert.ok(input.contentOverrides.SPEC_FIELD_ROWS.length > 0);
  assert.match(input.contentOverrides.WITH_SPEC_NOTE, /Abdeckungen/);
  assert.equal(input.contentOverrides.getPriceValidityDateLine(), "10.12.2026");
  assert.deepEqual(input.offerDetailsRowsList[0].map(([k]) => k), ["teilebezeichnung", "artikelnummer", "losgroesse", "preis"]);
});

test("an offer with no used part gives Document Preview one empty block, not none", () => {
  const offer = emptyOffer("ktl");
  const input = docPreviewInput("ktl", offer, {}, "en", makeT("en"));
  assert.deepEqual(input.offerDetailsRowsList, [[]]);
});
