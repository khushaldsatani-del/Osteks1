import React, { useState } from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../shared/ShiftCard";
import QtyInput from "../Planning/QtyInput";
import SaveBar from "./SaveBar";
import { PLAN_LINES, SHIFT_DEFS } from "../Planning/planningData";

// Available capacity (euro) per line and shift. Edits stay a draft until
// Save; the column headers show the saved shift times.
const LineCapacityCard = ({ capacity, shiftTimes, onSave }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(capacity);
  const [status, setStatus] = useState(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(capacity);

  return (
    <ShiftCard
      className="sset-card"
      title={t("shiftSettings.capacityTitle")}
      subtitle={t("shiftSettings.capacitySubtitle")}
    >
      <div className="sp-table-wrap">
        <table className="sp-table sset-capacity">
          <thead>
            <tr>
              <th>{t("shiftPlan.colLine")}</th>
              {SHIFT_DEFS.map((shift) => (
                <th key={shift.id} className="splan-center">
                  {shift.name}
                  <span>
                    {shiftTimes[shift.id].from} – {shiftTimes[shift.id].to}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_LINES.map((line) => (
              <tr key={line.id}>
                <td>
                  <span className={`splan-line splan-line--${line.id}`}>{line.name}</span>
                </td>
                {SHIFT_DEFS.map((shift) => (
                  <td key={shift.id} className="splan-center">
                    <QtyInput
                      className="sset-capacity-input"
                      value={draft[line.id]?.[shift.id] ?? 0}
                      label={t("shiftSettings.capacityLabel", { line: line.name, shift: shift.name })}
                      onChange={(value) => {
                        setDraft((prev) => ({ ...prev, [line.id]: { ...prev[line.id], [shift.id]: value } }));
                        setStatus(null);
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SaveBar
        hint={t("shiftSettings.capacityHint")}
        dirty={dirty}
        status={status}
        onSave={() => setStatus(onSave(draft) ? "saved" : "failed")}
      />
    </ShiftCard>
  );
};

export default LineCapacityCard;
