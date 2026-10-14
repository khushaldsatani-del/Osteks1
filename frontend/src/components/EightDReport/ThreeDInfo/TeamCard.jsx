import React from "react";
import { Users, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import CollapsibleCard from "../CollapsibleCard";
import PersonInput from "../PersonInput";

const COLUMNS = [
  { field: "name", labelKey: "eightD.colName", type: "text" },
  { field: "department", labelKey: "eightD.colDepartment", type: "text" },
  { field: "phone", labelKey: "eightD.colPhone", type: "tel" },
  { field: "email", labelKey: "eightD.colEmail", type: "email" },
];

// "1. Team" — one row per team member, growable. The names entered here
// are what Containment Actions' "Person in charge" dropdown offers.
const TeamCard = ({ team, updateMember, addMember, removeMember }) => {
  const { t } = useTranslation();

  return (
    <CollapsibleCard icon={Users} title={t("eightD.teamTitle")}>
      <div className="eightd-table-wrap">
        <table className="eightd-table eightd-table--team">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.field}>{t(column.labelKey)}</th>
              ))}
              <th className="eightd-table-action-col" />
            </tr>
          </thead>
          <tbody>
            {team.map((member) => (
              <tr key={member.id}>
                {COLUMNS.map((column) => (
                  <td key={column.field}>
                    {column.field === "name" ? (
                      <PersonInput
                        value={member.name}
                        onChange={(value) => updateMember(member.id, "name", value)}
                        onPick={(person) => {
                          // A regular person fills the rest of the row.
                          if (person.department) updateMember(member.id, "department", person.department);
                          if (person.phone) updateMember(member.id, "phone", person.phone);
                          if (person.email) updateMember(member.id, "email", person.email);
                        }}
                        ariaLabel={t(column.labelKey)}
                      />
                    ) : (
                      <input
                        type={column.type}
                        value={member[column.field]}
                        onChange={(event) => updateMember(member.id, column.field, event.target.value)}
                        aria-label={t(column.labelKey)}
                      />
                    )}
                  </td>
                ))}
                <td className="eightd-table-action-col">
                  <button
                    type="button"
                    className="eightd-row-remove"
                    onClick={() => removeMember(member.id)}
                    disabled={team.length === 1}
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

      <button type="button" className="eightd-add-row" onClick={addMember}>
        <Plus size={13} />
        {t("eightD.addMember")}
      </button>
    </CollapsibleCard>
  );
};

export default TeamCard;
