import React, { useState } from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../shared/ShiftCard";
import SaveBar from "./SaveBar";
import { SHIFT_DEFS } from "../Planning/planningData";
import { WEEKDAYS } from "./settingsData";

// Monday = 2024-01-01; used only to get the weekday's name in the language.
const weekdayName = (language, index) =>
  new Date(2024, 0, 1 + index).toLocaleDateString(language === "DE" ? "de-DE" : "en-GB", { weekday: "long" });

// Problems that block saving, by shift id (plus "days").
const validate = (draft, t) => {
  const errors = {};
  if (draft.workingDays.length === 0) errors.days = t("shiftSettings.errorNoDays");
  SHIFT_DEFS.forEach((shift) => {
    const { from, to, overnight } = draft.shiftTimes[shift.id];
    if (!from || !to) errors[shift.id] = t("shiftSettings.errorMissingTime");
    else if (from === to) errors[shift.id] = t("shiftSettings.errorSameTime");
    else if (overnight && to > from) errors[shift.id] = t("shiftSettings.errorOvernight");
    else if (!overnight && to < from)
      errors[shift.id] = shift.id === "nacht" ? t("shiftSettings.errorTickNextDay") : t("shiftSettings.errorEndBeforeStart");
  });
  return errors;
};

// Which weekdays are worked, and each shift's start / end time.
const WorkingTimesCard = ({ workingDays, shiftTimes, onSave }) => {
  const { t, language } = useTranslation();
  const saved = { workingDays, shiftTimes };
  const [draft, setDraft] = useState(saved);
  const [status, setStatus] = useState(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const errors = validate(draft, t);

  const setTime = (shiftId, field, value) => {
    setDraft((prev) => ({
      ...prev,
      shiftTimes: { ...prev.shiftTimes, [shiftId]: { ...prev.shiftTimes[shiftId], [field]: value } },
    }));
    setStatus(null);
  };

  const toggleDay = (day) => {
    setDraft((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : WEEKDAYS.filter((d) => d === day || prev.workingDays.includes(d)),
    }));
    setStatus(null);
  };

  return (
    <ShiftCard
      className="sset-card"
      title={t("shiftSettings.timesTitle")}
      subtitle={t("shiftSettings.timesSubtitle")}
    >
      <div className="sset-times">
        <fieldset className="sset-box sset-days">
          <legend>{t("shiftSettings.workingDays")}</legend>
          {WEEKDAYS.map((day, index) => (
            <label key={day} className="sset-check">
              <input type="checkbox" checked={draft.workingDays.includes(day)} onChange={() => toggleDay(day)} />
              <span>{weekdayName(language, index)}</span>
            </label>
          ))}
          {errors.days && <p className="sset-error">{errors.days}</p>}
        </fieldset>

        <fieldset className="sset-box sset-shift-times">
          <legend>{t("shiftSettings.shiftTimes")}</legend>
          {SHIFT_DEFS.map(({ id, name, icon: Icon }) => {
            const time = draft.shiftTimes[id];
            return (
              <div key={id} className="sset-shift">
                <div className="sset-shift-row">
                  <span className={`sset-shift-icon sset-shift-icon--${id}`}>
                    <Icon size={17} />
                  </span>
                  <span className="sset-shift-name">{name}</span>
                  <input
                    type="time"
                    value={time.from}
                    onChange={(event) => setTime(id, "from", event.target.value)}
                    aria-label={t("shiftSettings.startOf", { shift: name })}
                    aria-invalid={!!errors[id]}
                  />
                  <span className="sset-dash">–</span>
                  <input
                    type="time"
                    value={time.to}
                    onChange={(event) => setTime(id, "to", event.target.value)}
                    aria-label={t("shiftSettings.endOf", { shift: name })}
                    aria-invalid={!!errors[id]}
                  />
                </div>
                {id === "nacht" && (
                  <label className="sset-check sset-overnight">
                    <input type="checkbox" checked={!!time.overnight} onChange={(event) => setTime(id, "overnight", event.target.checked)} />
                    <span>{t("shiftSettings.overnight")}</span>
                  </label>
                )}
                {errors[id] && <p className="sset-error">{errors[id]}</p>}
              </div>
            );
          })}
        </fieldset>
      </div>

      <SaveBar
        dirty={dirty}
        invalid={Object.keys(errors).length > 0}
        status={status}
        onSave={() => setStatus(onSave(draft) ? "saved" : "failed")}
      />
    </ShiftCard>
  );
};

export default WorkingTimesCard;
