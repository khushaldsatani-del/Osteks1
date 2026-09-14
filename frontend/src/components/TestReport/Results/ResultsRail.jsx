import React from "react";

// The left sidebar inside Results — Overview, one entry per cycle
// checkpoint (dynamic, see buildResultSections), then Cross-cut Test.
const ResultsRail = ({ resultSections, resultsSection, setResultsSection }) => (
  <nav className="testreport-results-rail">
    {resultSections.map((section) => (
      <button
        type="button"
        key={section.id}
        className={`testreport-rail-item ${section.id === resultsSection ? "active" : ""}`}
        onClick={() => setResultsSection(section.id)}
      >
        <section.Icon size={15} />
        <span>{section.label}</span>
      </button>
    ))}
  </nav>
);

export default ResultsRail;
