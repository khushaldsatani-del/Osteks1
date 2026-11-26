// Key figures B20-B23 as in the KTL sheet: revenue per carrier / per m²
// come from the old calculation's sum (B29), revenue per year from the
// typed offer price (B34) x quantity.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcKtl } from "../src/components/OfferBuilder/engine/ktl.js";
import { DEFAULT_SETTINGS } from "../src/components/OfferBuilder/engine/defaults.js";

const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${label}: app ${actual} vs Excel ${expected}`);

test("the user's part: same weight, revenue per carrier / m² / year as their Excel", () => {
  const part = { quantity: 150000, surfaceMm2: 48917, weightG: 192, thicknessMm: 1, beizen: true, guss: false, maskingPoints: 0, loadMinutes: 18, workers: 2, paint: "D-KTL", offerPrice: 0.28 };
  const r = calcKtl(part, DEFAULT_SETTINGS.ktl);
  assert.equal(r.partsPerCarrier, 919);
  near(r.weightPerCarrier, 176.448, "B20 (176.45 kg)");
  near(r.revenuePerCarrier, 206.27711558500002, "B21 (206.28 €)");
  near(r.revenuePerM2, 4.5885526996796315, "B22 (4.59 €/m²)");
  near(r.revenuePerYear, 42000, "B23 (42,000.00 €)");
  near(r.old.sum, 0.22445823241022853, "B29 (0.2245 €)");
  near(r.old.price, 0.28169508167483684, "B32 (0.2817 €)");
});

test("B21 = B7 x B29 and B22 = B29 x 1,000,000 / B3 for all 25 Excel reference parts", () => {
  const reference = JSON.parse(readFileSync(new URL("./fixtures/excel-reference.json", import.meta.url), "utf8"));
  for (const { input: x, excel: e } of reference.ktl) {
    const r = calcKtl(
      { quantity: String(x.B2), surfaceMm2: String(x.B3), weightG: String(x.B4), thicknessMm: String(x.B14), beizen: x.B8 === "j", guss: x.B9 === "j", maskingPoints: String(x.B10), paint: x.E21, loadMinutes: String(x.B11), workers: String(x.B12) },
      DEFAULT_SETTINGS.ktl
    );
    near(r.revenuePerCarrier, e.B7 * e.B29, `B21 for B3=${x.B3}`);
    near(r.revenuePerM2, (e.B29 * 1e6) / x.B3, `B22 for B3=${x.B3}`);
  }
});
