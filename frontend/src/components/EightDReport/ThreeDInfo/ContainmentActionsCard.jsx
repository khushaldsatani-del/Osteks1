import React from "react";
import { ShieldCheck, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import CollapsibleCard from "../CollapsibleCard";
import DateOrWeekInput from "../DateOrWeekInput";
import PersonInput from "../PersonInput";

// "3. Containment Actions" — growable rows. Person in charge is picked
// from the team entered in card 1 (stored by member id, so a later rename
// there shows up here too).
const ContainmentActionsCard = ({ actions, team, updateAction, addAction, removeAction }) => {
  const { t } = useTranslation();
  const teamNames = team.map((member) => member.name);

  return (
    <CollapsibleCard icon={ShieldCheck} title={t("eightD.containmentTitle")}>
      <div className="eightd-table-wrap">
        <table className="eightd-table eightd-table--actions">
          <thead>
            <tr>
              <th>{t("eightD.colContainmentAction")}</th>
              <th>{t("eightD.colPersonInCharge")}</th>
              <th>{t("eightD.colDueDate")}</th>
              <th>{t("eightD.colCompletionDate")}</th>
              <th className="eightd-table-action-col" />
            </tr>
          </thead>
          <tbody>
            {actions.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="text"
                    value={row.action}
                    onChange={(event) => updateAction(row.id, "action", event.target.value)}
                    aria-label={t("eightD.colContainmentAction")}
                  />
                </td>
                <td>
                  <PersonInput
                    value={row.person}
                    onChange={(value) => updateAction(row.id, "person", value)}
                    extraNames={teamNames}
                    ariaLabel={t("eightD.colPersonInCharge")}
                  />
                </td>
                <td>
                  <DateOrWeekInput
                    value={row.dueDate}
                    onChange={(value) => updateAction(row.id, "dueDate", value)}
                    ariaLabel={t("eightD.colDueDate")}
                  />
                </td>
                <td>
                  <DateOrWeekInput
                    value={row.completionDate}
                    onChange={(value) => updateAction(row.id, "completionDate", value)}
                    ariaLabel={t("eightD.colCompletionDate")}
                  />
                </td>
                <td className="eightd-table-action-col">
                  <button
                    type="button"
                    className="eightd-row-remove"
                    onClick={() => removeAction(row.id)}
                    disabled={actions.length === 1}
                    aria-label={t("eightD.removeRow")}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="eightd-add-row" onClick={addAction}>
        <Plus size={13} />
        {t("eightD.addAction")}
      </button>
    </CollapsibleCard>
  );
};

export default ContainmentActionsCard;
