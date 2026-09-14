import React from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import AutoTextarea from "../AutoTextarea";

// Table 2 — Condensation Water Constant Climate test (the second entry
// Step 1's Tests list seeds by default). Fixed reference rows (same
// static-content role as Step 2's getCyclePhases / Step 3's
// getDefaultInspectionRows) — this test's duration is measured in hours at
// one fixed endpoint, not cycle checkpoints, so it doesn't share Table 1's
// CYCLE_DURATIONS-driven row set.
const CondensationEvaluationTable = ({ table2Rows, updateTable2Row, evaluationSummary2, setEvaluationSummary2 }) => {
  const { t } = useTranslation();

  return (
    <>
      <h3 className="testreport-results-heading">{t("testReport.eval2Heading")}</h3>

      <div className="testreport-table-wrap testreport-eval-table-wrap">
        <table className="testreport-table testreport-eval-table">
          <thead>
            <tr>
              <th>{t("testReport.colDuration")}</th>
              <th>{t("testReport.eval2ColResult")}</th>
              <th>{t("testReport.eval2ColRequirement")}</th>
              <th>{t("testReport.colAssessment")}</th>
            </tr>
          </thead>
          <tbody>
            {table2Rows.map((row) => (
              <tr key={row.id}>
                <td className="testreport-eval-cycle-cell">
                  <strong>{row.duration}</strong>
                </td>
                <td>
                  <AutoTextarea
                    className="testreport-eval-cell-textarea testreport-eval-cell-textarea--bold"
                    value={row.result}
                    onChange={(event) => updateTable2Row(row.id, "result", event.target.value)}
                  />
                </td>
                <td>
                  <AutoTextarea
                    className="testreport-eval-cell-textarea"
                    value={row.requirement}
                    onChange={(event) => updateTable2Row(row.id, "requirement", event.target.value)}
                  />
                </td>
                <td className="testreport-eval-status-cell">
                  <button
                    type="button"
                    className={`testreport-eval-status-btn testreport-eval-status-btn--${row.assessment === "Fulfilled" ? "ok" : "bad"}`}
                    onClick={() =>
                      updateTable2Row(row.id, "assessment", row.assessment === "Fulfilled" ? "Not Fulfilled" : "Fulfilled")
                    }
                  >
                    {row.assessment === "Fulfilled" ? t("testReport.fulfilledShort") : t("testReport.notFulfilledShort")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="testreport-field testreport-eval-summary-field">
        <label htmlFor="tr-eval-summary-2">{t("testReport.overallAssessment")}</label>
        <textarea
          id="tr-eval-summary-2"
          placeholder={t("testReport.overallAssessmentPlaceholder")}
          value={evaluationSummary2}
          onChange={(event) => setEvaluationSummary2(event.target.value)}
        />
      </div>
    </>
  );
};

export default CondensationEvaluationTable;
