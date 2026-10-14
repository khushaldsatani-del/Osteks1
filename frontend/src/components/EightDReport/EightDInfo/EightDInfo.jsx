import React from "react";
import { FileText } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import CollapsibleCard from "../CollapsibleCard";
import ActionRowsCard from "./ActionRowsCard";
import CheckboxOption from "../CheckboxOption";
import DateOrWeekInput from "../DateOrWeekInput";
import PersonInput from "../PersonInput";
import { FMEA_ROWS, FOLLOW_UP_ROWS, makeCorrectiveAction } from "../eightDReportConstants";

// Step 3 — "4. Root Cause(s)", "5. Corrective Actions Suggested",
// "6. Corrective Actions Implemented", "7. Preventive actions" and
// "8. Feedback". State lives in EightDReport.jsx.
const EightDInfo = ({ info, setInfo }) => {
  const { t } = useTranslation();

  const setField = (field) => (event) => setInfo((prev) => ({ ...prev, [field]: event.target.value }));

  const setCheck = (key, patch) =>
    setInfo((prev) => ({ ...prev, checks: { ...prev.checks, [key]: { ...prev.checks[key], ...patch } } }));

  // One group of No / Yes / n/a question rows, each with a free-text field
  // (labelled `fieldLabelKey`) at the right.
  const checkGroup = (rows, fieldLabelKey, className) => (
    <div className={className}>
      {rows.map(({ key, labelKey }) => {
        const row = info.checks[key];
        const setAnswer = (answer) => () => setCheck(key, { answer: row.answer === answer ? "" : answer });
        return (
          <div className="eightd-affected-row" key={key}>
            <div className="eightd-affected-main">
              <span className="eightd-affected-label">{t(labelKey)}</span>
              <div className="eightd-affected-options">
                <CheckboxOption checked={row.answer === "no"} onToggle={setAnswer("no")} label={t("eightD.no")} />
                <CheckboxOption checked={row.answer === "yes"} onToggle={setAnswer("yes")} label={t("eightD.yes")} />
                <CheckboxOption checked={row.answer === "na"} onToggle={setAnswer("na")} label={t("eightD.notApplicable")} />
              </div>
            </div>

            <div className="eightd-affected-extra eightd-affected-extra--plain">
              <div className="eightd-field eightd-field--inline">
                <label htmlFor={`ed8-check-${key}`}>{t(fieldLabelKey)}</label>
                <input
                  id={`ed8-check-${key}`}
                  type="text"
                  value={row.text}
                  onChange={(event) => setCheck(key, { text: event.target.value })}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Row handlers for one of the action lists ("correctiveActions" /
  // "implementedActions" / "preventiveActions"), ready to spread onto an ActionRowsCard.
  const rowHandlers = (list) => ({
    rows: info[list],
    updateRow: (id, field, value) =>
      setInfo((prev) => ({ ...prev, [list]: prev[list].map((row) => (row.id === id ? { ...row, [field]: value } : row)) })),
    addRow: () => setInfo((prev) => ({ ...prev, [list]: [...prev[list], makeCorrectiveAction()] })),
    removeRow: (id) =>
      setInfo((prev) => (prev[list].length > 1 ? { ...prev, [list]: prev[list].filter((row) => row.id !== id) } : prev)),
  });

  return (
    <>
      <h2 className="eightd-section-title">{t("eightD.step8DInfo")}</h2>

      <CollapsibleCard icon={FileText} title={t("eightD.rootCauseTitle")}>
        <div className="eightd-field">
          <label htmlFor="ed8-rootCause">{t("eightD.rootCauseDescription")}</label>
          <textarea
            id="ed8-rootCause"
            rows={3}
            className="eightd-textarea--tall"
            value={info.rootCause}
            onChange={setField("rootCause")}
          />
        </div>
      </CollapsibleCard>

      <ActionRowsCard title={t("eightD.correctiveTitle")} idPrefix="ed8-suggested" {...rowHandlers("correctiveActions")} />

      <ActionRowsCard
        title={t("eightD.implementedTitle")}
        idPrefix="ed8-implemented"
        {...rowHandlers("implementedActions")}
      />

      <ActionRowsCard
        title={t("eightD.preventiveTitle")}
        subtitle={t("eightD.preventiveSubtitle")}
        idPrefix="ed8-preventive"
        actionLabel={t("eightD.preventiveAction")}
        actionPlaceholder={t("eightD.preventiveActionPlaceholder")}
        personPlaceholder={t("eightD.personPlaceholder")}
        {...rowHandlers("preventiveActions")}
      >
        {checkGroup(FMEA_ROWS, "eightD.fmeaReason", "eightd-affected eightd-affected--fmea")}
        {checkGroup(FOLLOW_UP_ROWS, "eightD.result", "eightd-affected eightd-affected--follow-up")}
      </ActionRowsCard>

      <CollapsibleCard icon={FileText} title={t("eightD.feedbackTitle")} subtitle={t("eightD.feedbackSubtitle")}>
        <div className="eightd-grid-3 eightd-grid--top">
          <div className="eightd-field">
            <label htmlFor="ed8-closureDate">{t("eightD.closureDate")}</label>
            <DateOrWeekInput
              id="ed8-closureDate"
              value={info.closureDate}
              onChange={(value) => setInfo((prev) => ({ ...prev, closureDate: value }))}
            />
          </div>

          <div className="eightd-field">
            <label htmlFor="ed8-closurePerson">{t("eightD.closurePerson")}</label>
            <PersonInput
              id="ed8-closurePerson"
              multiline
              placeholder={t("eightD.personPlaceholder")}
              value={info.closurePerson}
              onChange={(value) => setInfo((prev) => ({ ...prev, closurePerson: value }))}
            />
          </div>

          <div className="eightd-field">
            <label htmlFor="ed8-remarks">{t("eightD.remarks")}</label>
            <textarea
              id="ed8-remarks"
              rows={1}
              className="eightd-textarea--line"
              value={info.remarks}
              onChange={setField("remarks")}
            />
          </div>
        </div>
      </CollapsibleCard>
    </>
  );
};

export default EightDInfo;
