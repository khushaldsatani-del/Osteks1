// The "KTL / Powder · Calculation" tabs: every row has a label and a
// formula in both languages, every {placeholder} is filled with the
// current settings, and the numbers follow the settings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formulaSections } from "../src/components/OfferBuilder/components/settings/formulas.js";
import { costTable } from "../src/components/OfferBuilder/engine/ktl.js";
import { DEFAULT_SETTINGS } from "../src/components/OfferBuilder/engine/defaults.js";
import { setFormatLocale } from "../src/components/OfferBuilder/engine/format.js";
import { LOCALES, makeT } from "../src/components/OfferBuilder/i18n/offerT.js";

const build = (process, language, settings = DEFAULT_SETTINGS) => {
  setFormatLocale(LOCALES[language]);
  return formulaSections(process, settings[process], costTable(settings.ktl), makeT(language));
};

for (const language of ["de", "en"]) {
  for (const process of ["ktl", "pulver"]) {
    test(`${process} formulas in ${language}: complete, nothing left unfilled`, () => {
      const sections = build(process, language);
      assert.ok(sections.length >= 5);
      for (const section of sections) {
        assert.ok(section.title && !section.title.startsWith("settings."), `section title ${section.key}`);
        for (const row of section.rows) {
          assert.ok(typeof row.label === "string" && row.label.length > 2, `${row.cell} label`);
          assert.ok(typeof row.formula === "string" && row.formula.length > 5, `${row.cell} formula`);
          assert.doesNotMatch(row.formula, /\{\w+\}/, `${row.cell} has an unfilled placeholder: ${row.formula}`);
          assert.doesNotMatch(row.formula, /NaN|undefined|Infinity/, `${row.cell}: ${row.formula}`);
        }
      }
    });
  }
}

test("the machine-hour rate formula shows the real numbers, in the language's style", () => {
  const de = build("ktl", "de").find((s) => s.key === "machine").rows.find((r) => r.cell === "L22").formula;
  assert.match(de, /520,3167\s€/); // Intl puts a non-breaking space before €
  assert.match(de, /4\.590 h/);
  const en = build("ktl", "en").find((s) => s.key === "machine").rows.find((r) => r.cell === "L22").formula;
  assert.match(en, /€520\.3167/);
  assert.match(en, /4,590 h/);
});

test("a changed setting changes its formula", () => {
  const settings = { ...DEFAULT_SETTINGS, ktl: { ...DEFAULT_SETTINGS.ktl, overhead: 0.2 }, pulver: { ...DEFAULT_SETTINGS.pulver, chainSpeed: 3 } };
  const overhead = build("ktl", "de", settings).flatMap((s) => s.rows).find((r) => r.cell === "F28").formula;
  assert.match(overhead, /20 %/);
  const speed = build("pulver", "de", settings).flatMap((s) => s.rows).find((r) => r.cell === "H10").formula;
  assert.match(speed, /^3,0 m\/min/);
});
