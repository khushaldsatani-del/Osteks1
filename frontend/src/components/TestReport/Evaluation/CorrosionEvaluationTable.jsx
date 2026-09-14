import React from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import AutoTextarea from "../AutoTextarea";
import { CYCLE_DURATIONS } from "../testReportConstants";

// Table 1 — one row per cycle checkpoint, same set Results' rail shows
// (kept in sync with Test Duration). No Test Method dropdown here — the
// heading names the exact test this table is for.
const CorrosionEvaluationTable = ({
  durationCycles,
  evaluationSyncedRows,
  updateEvaluationSyncedRow,
  evaluationSummary,
  setEvaluationSummary,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <h3 className="testreport-results-heading">{t("testReport.eval1Heading")}</h3>

      <div className="testreport-table-wrap testreport-eval-table-wrap">
        <table className="testreport-table testreport-eval-table">
          <thead>
            <tr>
              <th>{t("testReport.colDuration")}</th>
              <th>{t("testReport.colResult")}</th>
              <th>{t("testReport.colRequirementSpec")}</th>
              <th>{t("testReport.colAssessment")}</th>
            </tr>
          </thead>
          <tbody>
            {CYCLE_DURATIONS.filter((cycles) => cycles <= Number(durationCycles)).map((cycles) => {
              const row = evaluationSyncedRows[cycles];
              return (
                <tr key={cycles}>
                  <td className="testreport-eval-cycle-cell">
                    <strong>{cycles}</strong> {t("testReport.cyclesUnit")}
                  </td>
                  <td>
                    <AutoTextarea
                      className="testreport-eval-cell-textarea"
                      value={row.result}
                      onChange={(event) => updateEvaluationSyncedRow(cycles, "result", event.target.value)}
                    />
                  </td>
                  <td>
                    <AutoTextarea
                      className="testreport-eval-cell-textarea"
                      value={row.requirement}
                      onChange={(event) => updateEvaluationSyncedRow(cycles, "requirement", event.target.value)}
                    />
                  </td>
                  <td className="testreport-eval-status-cell">
                    <button
                      type="button"
                      className={`testreport-eval-status-btn testreport-eval-status-btn--${row.assessment === "Fulfilled" ? "ok" : "bad"}`}
                      onClick={() =>
                        updateEvaluationSyncedRow(cycles, "assessment", row.assessment === "Fulfilled" ? "Not Fulfilled" : "Fulfilled")
                      }
                    >
                      {row.assessment === "Fulfilled" ? t("testReport.fulfilledShort") : t("testReport.notFulfilledShort")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="testreport-field testreport-eval-summary-field">
        <label htmlFor="tr-eval-summary">{t("testReport.overallAssessment")}</label>
        <textarea
          id="tr-eval-summary"
          placeholder={t("testReport.overallAssessmentPlaceholder")}
          value={evaluationSummary}
          onChange={(event) => setEvaluationSummary(event.target.value)}
        />
      </div>
    </>
  );
};

export default CorrosionEvaluationTable;
