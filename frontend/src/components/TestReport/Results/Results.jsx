import React from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { buildResultSections } from "../testReportConstants";
import ResultsRail from "./ResultsRail";
import ResultsContent from "./ResultsContent";

// Step 3 — two components: the rail (left sidebar) and the content (right
// area), matching how this step visually splits into "sidebar and all".
const Results = ({ durationCycles, subjectTask, resultsSection, setResultsSection, cyclesData, ...contentProps }) => {
  const { t } = useTranslation();

  const resultSections = buildResultSections(durationCycles, t, subjectTask);
  const activeSection = resultSections.find((section) => section.id === resultsSection) ?? resultSections[0];
  const cycleSections = resultSections.filter((section) => section.kind === "cycles");
  const cycle = cyclesData[resultsSection];
  // The highest cycle count currently shown (i.e. matching the selected
  // Test Duration) gets the button-revealed final delamination card
  // instead of the auto-triggered one below — every other ("in between")
  // cycle keeps the unchanged Fail/Conditional auto-trigger behavior.
  const isLastCycle = activeSection.kind === "cycles" && activeSection.cycles === Number(durationCycles);

  return (
    <>
      <h2 className="testreport-section-title">
        {t("testReport.sectionResults")} – {activeSection.label}
      </h2>

      <div className="testreport-results-layout">
        <ResultsRail resultSections={resultSections} resultsSection={resultsSection} setResultsSection={setResultsSection} />

        <div className="testreport-results-content">
          <ResultsContent
            activeSection={activeSection}
            isLastCycle={isLastCycle}
            cycle={cycle}
            resultsSection={resultsSection}
            durationCycles={durationCycles}
            cycleSections={cycleSections}
            cyclesData={cyclesData}
            {...contentProps}
          />
        </div>
      </div>
    </>
  );
};

export default Results;
