import React from "react";
import { MessageSquareWarning } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import CollapsibleCard from "../CollapsibleCard";
import CheckboxOption from "../CheckboxOption";
import TeamCard from "./TeamCard";
import ContainmentActionsCard from "./ContainmentActionsCard";
import { AFFECTED_ROWS, makeTeamMember, makeContainmentAction } from "../eightDReportConstants";

// Step 2 — the "Quality Complaint Form": 1. Team, 2. Failure Description
// (2.1/2.2 plus the three "parts affected?" rows, all one card), and
// 3. Containment Actions. All state lives in EightDReport.jsx; `setInfo`
// is its functional setter for this step's slice.
const ThreeDInfo = ({ info, setInfo }) => {
  const { t } = useTranslation();

  const setField = (field) => (event) => setInfo((prev) => ({ ...prev, [field]: event.target.value }));

  const updateRow = (list) => (id, field, value) =>
    setInfo((prev) => ({ ...prev, [list]: prev[list].map((row) => (row.id === id ? { ...row, [field]: value } : row)) }));
  const addRow = (list, make) => () => setInfo((prev) => ({ ...prev, [list]: [...prev[list], make()] }));
  const removeRow = (list) => (id) =>
    setInfo((prev) => (prev[list].length > 1 ? { ...prev, [list]: prev[list].filter((row) => row.id !== id) } : prev));

  const setAffected = (key, patch) =>
    setInfo((prev) => ({ ...prev, affected: { ...prev.affected, [key]: { ...prev.affected[key], ...patch } } }));

  return (
    <>
      <h2 className="eightd-section-title">{t("eightD.threeDTitle")}</h2>

      <TeamCard
        team={info.team}
        updateMember={updateRow("team")}
        addMember={addRow("team", makeTeamMember)}
        removeMember={removeRow("team")}
      />

      <CollapsibleCard icon={MessageSquareWarning} title={t("eightD.failureTitle")}>
        <div className="eightd-grid-2 eightd-failure-grid">
          <div className="eightd-field">
            <label htmlFor="ed3-customerFailure">{t("eightD.customerFailureTitle")}</label>
            <textarea
              id="ed3-customerFailure"
              rows={3}
              value={info.customerFailure}
              onChange={setField("customerFailure")}
            />
          </div>

          <div className="eightd-field">
            <label htmlFor="ed3-osteksFailure">{t("eightD.osteksFailureTitle")}</label>
            <textarea id="ed3-osteksFailure" rows={3} value={info.osteksFailure} onChange={setField("osteksFailure")} />
          </div>
        </div>

        <div className="eightd-affected">
          {AFFECTED_ROWS.map(({ key, labelKey }) => {
            const row = info.affected[key];
            const setAnswer = (answer) => () => setAffected(key, { answer: row.answer === answer ? "" : answer });
            return (
              <div className="eightd-affected-row" key={key}>
                <div className="eightd-affected-main">
                  <span className="eightd-affected-label">{t(labelKey)}</span>
                  <div className="eightd-affected-options">
                    <CheckboxOption checked={row.answer === "no"} onToggle={setAnswer("no")} label={t("eightD.no")} />
                    <CheckboxOption checked={row.answer === "yes"} onToggle={setAnswer("yes")} label={t("eightD.yes")} />
                    <CheckboxOption
                      checked={row.sorted}
                      onToggle={() => setAffected(key, { sorted: !row.sorted })}
                      label={t("eightD.partsSorted")}
                    />
                  </div>
                </div>

                {key === "shipped" && (
                  <div className="eightd-affected-extra">
                    <div className="eightd-field eightd-field--inline">
                      <label htmlFor="ed3-deliveryNoteNo">{t("eightD.deliveryNoteNo")}</label>
                      <input
                        id="ed3-deliveryNoteNo"
                        type="text"
                        value={info.deliveryNoteNo}
                        onChange={setField("deliveryNoteNo")}
                      />
                    </div>
                    <div className="eightd-field eightd-field--inline">
                      <label htmlFor="ed3-quantity">{t("eightD.quantity")}</label>
                      <input id="ed3-quantity" type="text" value={info.quantity} onChange={setField("quantity")} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleCard>

      <ContainmentActionsCard
        actions={info.actions}
        team={info.team}
        updateAction={updateRow("actions")}
        addAction={addRow("actions", makeContainmentAction)}
        removeAction={removeRow("actions")}
      />
    </>
  );
};

export default ThreeDInfo;
