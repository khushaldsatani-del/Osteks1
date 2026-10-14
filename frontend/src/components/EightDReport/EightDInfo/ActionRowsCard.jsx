import React from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import CollapsibleCard from "../CollapsibleCard";
import DateOrWeekInput from "../DateOrWeekInput";
import PersonInput from "../PersonInput";

// A card holding a growable list of corrective-action rows (action /
// person in charge / due date / completion date). Shared by "5. Corrective
// Actions Suggested", "6. Corrective Actions Implemented" and "7.
// Preventive actions", which have the same fields. `idPrefix` keeps the
// cards' input ids distinct; the label/placeholder props are optional, and
// `children` render below the rows (section 7's FMEA questions).
const ActionRowsCard = ({
  title,
  subtitle,
  idPrefix,
  actionLabel,
  actionPlaceholder,
  personPlaceholder,
  rows,
  updateRow,
  addRow,
  removeRow,
  children,
}) => {
  const { t } = useTranslation();

  return (
    <CollapsibleCard icon={FileText} title={title} subtitle={subtitle}>
      {rows.map((row) => (
        <div className="eightd-action-row" key={row.id}>
          <div className="eightd-grid-action">
            <div className="eightd-field">
              <label htmlFor={`${idPrefix}-action-${row.id}`}>{actionLabel ?? t("eightD.correctiveAction")}</label>
              <textarea
                id={`${idPrefix}-action-${row.id}`}
                rows={1}
                className="eightd-textarea--line"
                placeholder={actionPlaceholder}
                value={row.action}
                onChange={(event) => updateRow(row.id, "action", event.target.value)}
              />
            </div>

            <div className="eightd-field">
              <label htmlFor={`${idPrefix}-person-${row.id}`}>{t("eightD.colPersonInCharge")}</label>
              <PersonInput
                id={`${idPrefix}-person-${row.id}`}
                placeholder={personPlaceholder}
                value={row.person}
                onChange={(value) => updateRow(row.id, "person", value)}
              />
            </div>

            <div className="eightd-field">
              <label htmlFor={`${idPrefix}-due-${row.id}`}>{t("eightD.colDueDate")}</label>
              <DateOrWeekInput
                id={`${idPrefix}-due-${row.id}`}
                value={row.dueDate}
                onChange={(value) => updateRow(row.id, "dueDate", value)}
              />
            </div>

            <div className="eightd-field">
              <label htmlFor={`${idPrefix}-completion-${row.id}`}>{t("eightD.colCompletionDate")}</label>
              <DateOrWeekInput
                id={`${idPrefix}-completion-${row.id}`}
                value={row.completionDate}
                onChange={(value) => updateRow(row.id, "completionDate", value)}
              />
            </div>
          </div>

          <button
            type="button"
            className="eightd-row-remove"
            onClick={() => removeRow(row.id)}
            disabled={rows.length === 1}
            aria-label={t("eightD.removeRow")}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}

      <button type="button" className="eightd-add-row" onClick={addRow}>
        <Plus size={13} />
        {t("eightD.addAction")}
      </button>

      {children}
    </CollapsibleCard>
  );
};

export default ActionRowsCard;
