import React from "react";
import { formulaSections } from "./formulas";
import { useT } from "../../i18n/languageContext";

// "KTL / Powder · Calculation": every calculated value with how it is
// calculated, section by section in the sheet's order. Read-only - the
// values are changed in the other tabs, and the formulas follow them.
const FormulaList = ({ process, settings, table }) => {
  const { t } = useT();
  const sections = formulaSections(process, settings, table, t);
  return (
    <div className="formulas">
      <p className="formulas-intro">{t("settings.formulas.intro")}</p>
      {sections.map((section) => (
        <section key={section.key} className="formulas-section">
          <h4>{section.title}</h4>
          <ol className="formulas-rows">
            {section.rows.map((row) => (
              <li key={row.cell} className={`${row.strong ? "is-strong" : ""} ${row.info ? "is-info" : ""}`}>
                <span className="formulas-label">
                  {row.label}
                  <em className="cellref">{row.cell}</em>
                </span>
                <span className="formulas-formula">
                  {row.formula}
                  {row.info && <small>{t("settings.formulas.notInPrice")}</small>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
};

export default FormulaList;
