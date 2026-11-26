// How numbers are written in the number boxes: English 1,50,000.5,
// German 150.000,5 - and that the calculation always gets the plain number.
import { test } from "node:test";
import assert from "node:assert/strict";
import { caretAfter, groupDigits, readTyped, showPlaceholder, showValue } from "../src/components/OfferBuilder/engine/numberText.js";

test("grouping: English in lakh style, German in thousands", () => {
  const cases = [
    ["5", "5", "5"],
    ["150", "150", "150"],
    ["1500", "1,500", "1.500"],
    ["15000", "15,000", "15.000"],
    ["150000", "1,50,000", "150.000"],
    ["1500000", "15,00,000", "1.500.000"],
    ["12345678", "1,23,45,678", "12.345.678"],
  ];
  for (const [digits, en, de] of cases) {
    assert.equal(groupDigits(digits, "en"), en, `en ${digits}`);
    assert.equal(groupDigits(digits, "de"), de, `de ${digits}`);
  }
});

test("typing 150000 shows 1,50,000 (en) / 150.000 (de) and stores 150000", () => {
  assert.deepEqual(readTyped("150000", "en"), { display: "1,50,000", value: 150000 });
  assert.deepEqual(readTyped("150000", "de"), { display: "150.000", value: 150000 });
});

test("typing over an already grouped number keeps working", () => {
  assert.deepEqual(readTyped("1,50,0007", "en"), { display: "15,00,007", value: 1500007 });
  assert.deepEqual(readTyped("150.0007", "de"), { display: "1.500.007", value: 1500007 });
});

test("decimals: point in English, comma in German - also while still typing", () => {
  assert.deepEqual(readTyped("63694.5", "en"), { display: "63,694.5", value: 63694.5 });
  assert.deepEqual(readTyped("63694,5", "de"), { display: "63.694,5", value: 63694.5 });
  assert.deepEqual(readTyped("150000.", "en"), { display: "1,50,000.", value: 150000 });
  assert.deepEqual(readTyped("150000,", "de"), { display: "150.000,", value: 150000 });
  assert.deepEqual(readTyped("0,4", "de"), { display: "0,4", value: 0.4 });
  assert.deepEqual(readTyped(",4", "de"), { display: "0,4", value: 0.4 });
  assert.deepEqual(readTyped("0.395", "en"), { display: "0.395", value: 0.395 });
  assert.deepEqual(readTyped("1,234", "de"), { display: "1,234", value: 1.234 }, "German 1,234 is one point two three four, not 1234");
});

test("only the first decimal mark counts; letters and other marks are dropped", () => {
  assert.deepEqual(readTyped("1.2.3", "en"), { display: "1.23", value: 1.23 });
  assert.deepEqual(readTyped("12abc3", "en"), { display: "123", value: 123 });
  assert.deepEqual(readTyped("€ 45", "de"), { display: "45", value: 45 });
  assert.deepEqual(readTyped("007", "en"), { display: "7", value: 7 });
});

test("empty, a lone minus and negatives", () => {
  assert.deepEqual(readTyped("", "en"), { display: "", value: "" });
  assert.deepEqual(readTyped("   ", "de"), { display: "", value: "" });
  assert.deepEqual(readTyped("-", "en"), { display: "-", value: "" });
  assert.deepEqual(readTyped("-63694", "de"), { display: "-63.694", value: -63694 });
});

test("stored values are shown in the language's style - also older typed text", () => {
  assert.equal(showValue(150000, "en"), "1,50,000");
  assert.equal(showValue(150000, "de"), "150.000");
  assert.equal(showValue(0.395, "de"), "0,395");
  assert.equal(showValue(1.234, "de"), "1,234");
  assert.equal(showValue(1.234, "en"), "1.234");
  assert.equal(showValue("10.000", "en"), "10,000", "older German-typed text");
  assert.equal(showValue("0,4", "en"), "0.4");
  assert.equal(showValue("1", "de"), "1");
  assert.equal(showValue(-5, "en"), "-5");
  assert.equal(showValue("", "en"), "");
  assert.equal(showValue(null, "de"), "");
});

test("a stored value always shows the same in its box and goes back unchanged", () => {
  for (const n of [0, 1, 7.5, 0.395, 1.234, 2.5, 63694, 150000, 1503.18, 12345678.25]) {
    for (const language of ["en", "de"]) {
      const shown = showValue(n, language);
      assert.equal(readTyped(shown, language).value, n, `${n} ${language} -> ${shown}`);
    }
  }
});

test("placeholders: plain numbers in the box's style, anything else as it is", () => {
  assert.equal(showPlaceholder("2.5", "de"), "2,5");
  assert.equal(showPlaceholder("120", "en"), "120");
  assert.equal(showPlaceholder("–", "en"), "–");
  assert.equal(showPlaceholder("0,23", "de"), "0,23");
  assert.equal(showPlaceholder(undefined, "de"), undefined);
});

test("the caret stays behind the digit just typed", () => {
  // typed "15000|0" -> shows "1,50,000": the caret after five digits
  assert.equal(caretAfter("15000", "1,50,000", "en"), 7);
  assert.equal(caretAfter("15000", "150.000", "de"), 6);
  assert.equal(caretAfter("", "1,50,000", "en"), 0);
  assert.equal(caretAfter("150000,", "150.000,", "de"), 8);
});
