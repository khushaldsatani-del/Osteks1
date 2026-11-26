// Number parsing (what users type, German / English / Indian grouping)
// and the mapping of an AI extraction onto a KTL / Powder part.
import { test } from "node:test";
import assert from "node:assert/strict";
import { numOr, parseNum } from "../src/components/OfferBuilder/engine/format.js";
import { layerFromKb, normOf, partFromExtraction } from "../src/components/OfferBuilder/state/fromExtraction.js";

test("parseNum reads German, English and Indian number styles", () => {
  const cases = [
    ["0,4", 0.4],
    ["0.4", 0.4],
    ["0.395", 0.395],
    ["10.000", 10000],
    ["10,000", 10000],
    ["1.234,5", 1234.5],
    ["1,234.5", 1234.5],
    ["150000", 150000],
    ["1,50,000", 150000],
    ["12,50,000", 1250000],
    [" 12 ", 12],
    ["1 234", 1234],
    ["-5", -5],
    ["1e3", 1000],
    [12.5, 12.5],
  ];
  for (const [input, expected] of cases) assert.equal(parseNum(input), expected, JSON.stringify(input));
});

test("parseNum turns anything that is not a number into 0, never NaN / Infinity", () => {
  for (const input of ["", " ", "abc", "12abc", "Infinity", "-Infinity", "NaN", "1e400", null, undefined, {}, [], NaN, Infinity, "1,2,3"]) {
    const n = parseNum(input);
    assert.ok(Number.isFinite(n), `${JSON.stringify(input)} -> ${n}`);
  }
});

test("numOr: an empty field means the default, a typed 0 stays 0", () => {
  assert.equal(numOr("", 32), 32);
  assert.equal(numOr("  ", 32), 32);
  assert.equal(numOr(undefined, 32), 32);
  assert.equal(numOr(null, 32), 32);
  assert.equal(numOr("0", 32), 0);
  assert.equal(numOr("28,5", 32), 28.5);
});

const SUMMARY = [
  "Part Name: Halter links",
  "Part Number: 5Q0 802 123",
  "Material: Aluminium AlMg3",
  "Sheet Thickness: 2 mm",
  "Weight: 0,59 kg",
  "Surface Treatment: VW 13750 Of1-x634",
  "Coating Thickness: 25 µm",
  "Surface Area: 150318 mm²",
  "Annual Quantity: 150.000 Stück",
].join("\n");

test("an extraction fills a KTL part, with Of1 read as Ofl", () => {
  assert.deepEqual(partFromExtraction("ktl", SUMMARY), {
    name: "Halter links",
    quantity: "150000",
    weightG: "590",
    thicknessMm: "2",
    drawingNo: "5Q0 802 123",
    paintSpec: "VW 13750 Ofl-x634",
    layer: "25 µm",
    surfaceMm2: "150318",
  });
});

test("an extraction fills a Powder part (cm², material, layer in µm)", () => {
  assert.deepEqual(partFromExtraction("pulver", SUMMARY), {
    name: "Halter links",
    quantity: "150000",
    weightG: "590",
    thicknessMm: "2",
    customerArticleNo: "5Q0 802 123",
    material: "aluminium",
    surfaceCm2: "1503.18",
    layerUm: "25",
  });
});

test("an empty, broken or unspecified extraction fills nothing and never throws", () => {
  for (const summary of ["", null, undefined, "garbage without colons", "Part Name: Not specified on drawing\nWeight: Not specified on drawing", 42]) {
    assert.deepEqual(partFromExtraction("ktl", summary), {});
    assert.deepEqual(partFromExtraction("pulver", summary), {});
  }
});

test("the norm's thickness from the standards library", () => {
  assert.equal(layerFromKb({ thickness: { min: 15, max: 30, unit: "µm" } }), "15-30 µm");
  assert.equal(layerFromKb({ thickness: { min: 20, max: 20, unit: "µm" } }), "20 µm");
  assert.equal(layerFromKb({ thickness: { display: "≥ 8 µm" } }), "≥ 8 µm");
  assert.equal(layerFromKb(null), undefined);
  assert.equal(layerFromKb({}), undefined);
});

test("normOf prefers the typed spec, then the drawing's", () => {
  assert.equal(normOf({ paintSpec: "VW 13750 Ofl-x634" }), "VW 13750 Ofl-x634");
  assert.equal(normOf({ extraction: { summary: "Surface Treatment: TL 227" } }), "TL 227");
  assert.equal(normOf({}), "");
});
