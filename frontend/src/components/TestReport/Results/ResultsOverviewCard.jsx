import React from "react";
import { Layers } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";

// The fixed delamination requirement this report's own narrative text
// already quotes elsewhere (see the 30-cycle evaluation seed text and the
// Enthaftung section's own d ≤ 1,5 mm wording) — shown here only for a
// checkpoint that actually has a measured delamination value, exactly like
// the reference design's "–" for every other row.
const DELAMINATION_REQUIREMENT_MM = "≤ 1.50 mm";

// Worst-of across a cycle's inspection rows — Fail beats Conditional beats
// Pass, matching the same "does any row need attention" rule the
// auto-triggered Enthaftung section already uses (see ResultsContent.jsx).
const worstAssessment = (rows) => {
  if (!rows || !rows.length) return "Pass";
  if (rows.some((row) => row.assessment === "Fail")) return "Fail";
  if (rows.some((row) => row.assessment === "Conditional")) return "Conditional";
  return "Pass";
};

// A cycle's own single delamination reading — the auto-triggered card's
// dAfter (or dBefore, whichever is actually filled in) for every checkpoint
// except the last, which logs its readings as a list of entries instead
// (see the "Add Delamination Measurement" button) — the most recent
// entry's own dAfter/dBefore stands in for that checkpoint's row here.
const delaminationValue = (cycleData, isLast) => {
  if (isLast) {
    const entries = cycleData?.finalDelamination?.entries || [];
    const last = entries[entries.length - 1];
    return (last?.dAfter || last?.dBefore || "").trim();
  }
  return (cycleData?.delamination?.dAfter || cycleData?.delamination?.dBefore || "").trim();
};

// Step 3 Results' "Overview" rail item — a single-glance summary of every
// checkpoint this report has run so far, reusing exactly the same data the
// rest of Results/Evaluation already collects (never a separate source of
// truth): each cycle's Evaluation-table Result text, its own inspection
// rows' worst Pass/Fail/Conditional verdict, and its delamination reading
// if one was ever triggered.
const ResultsOverviewCard = ({ durationCycles, evaluationSyncedRows, cycleSections, cyclesData }) => {
  const { t } = useTranslation();

  const lastCycle = cycleSections.length ? cycleSections[cycleSections.length - 1].cycles : null;

  const rows = cycleSections.map((section) => {
    const cycleData = cyclesData[section.id];
    const isLast = section.cycles === lastCycle;
    const dValue = delaminationValue(cycleData, isLast);
    return {
      cycles: section.cycles,
      observation: evaluationSyncedRows?.[section.cycles]?.result || "—",
      delamination: dValue || "–",
      requirement: dValue ? DELAMINATION_REQUIREMENT_MM : "–",
      assessment: worstAssessment(cycleData?.rows),
    };
  });

  return (
    <div className="testreport-card testreport-results-overview">
      <div className="testreport-overview-stats">
        <div className="testreport-overview-stat">
          <span className="testreport-overview-stat-label">
            <Layers size={13} />
            {t("testReport.overviewActualCycles")}
          </span>
          <div className="testreport-overview-stat-value">{durationCycles || "—"}</div>
        </div>
      </div>

      <h3 className="testreport-overview-heading">{t("testReport.overviewResultsHeading")}</h3>

      <div className="testreport-table-wrap">
        <table className="testreport-table testreport-overview-table">
          <thead>
            <tr>
              <th>{t("testReport.overviewColCycles")}</th>
              <th>{t("testReport.overviewColObservation")}</th>
              <th>{t("testReport.overviewColDelamination")}</th>
              <th>{t("testReport.overviewColRequirement")}</th>
              <th>{t("testReport.overviewColAssessment")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cycles}>
                <td>{row.cycles}</td>
                <td>{row.observation}</td>
                <td>{row.delamination}</td>
                <td>{row.requirement}</td>
                <td>
                  <span className={`testreport-overview-badge testreport-overview-badge--${row.assessment.toLowerCase()}`}>
                    {t(`testReport.assessment${row.assessment}`)}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="testreport-overview-empty">
                  {t("testReport.overviewNoCycles")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsOverviewCard;
