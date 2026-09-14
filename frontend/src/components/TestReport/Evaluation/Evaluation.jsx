import React from "react";
import { Info } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import CorrosionEvaluationTable from "./CorrosionEvaluationTable";
import CondensationEvaluationTable from "./CondensationEvaluationTable";

// Step 4 — both tables live in one card, a divider separating them, same
// pattern as Results' merged "Condition after N cycles" / "N Cycles – Test
// Results" card.
const Evaluation = ({
  durationCycles,
  evaluationSyncedRows,
  updateEvaluationSyncedRow,
  evaluationSummary,
  setEvaluationSummary,
  table2Rows,
  updateTable2Row,
  evaluationSummary2,
  setEvaluationSummary2,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="testreport-card">
        <CorrosionEvaluationTable
          durationCycles={durationCycles}
          evaluationSyncedRows={evaluationSyncedRows}
          updateEvaluationSyncedRow={updateEvaluationSyncedRow}
          evaluationSummary={evaluationSummary}
          setEvaluationSummary={setEvaluationSummary}
        />

        <hr className="testreport-card-divider" />

        <CondensationEvaluationTable
          table2Rows={table2Rows}
          updateTable2Row={updateTable2Row}
          evaluationSummary2={evaluationSummary2}
          setEvaluationSummary2={setEvaluationSummary2}
        />
      </div>

      <div className="testreport-info-banner">
        <Info size={16} />
        <span>{t("testReport.evaluationNote")}</span>
      </div>
    </>
  );
};

export default Evaluation;
