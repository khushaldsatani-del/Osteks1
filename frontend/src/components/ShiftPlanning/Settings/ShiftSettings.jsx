import React, { useState } from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import LineCapacityCard from "./LineCapacityCard";
import WorkingTimesCard from "./WorkingTimesCard";
import PartMasterCard from "./PartMasterCard";
import { loadMasterParts, loadSettings, saveMasterParts, saveSettings } from "./settingsStorage";
import "../Planning/shiftPlan.css";
import "./shiftSettings.css";

// Shift Planning > Settings: line capacity per shift, working days and
// shift times, and the part master data. Kept in this browser until there
// is a shift-planning backend (settingsStorage.js).
const ShiftSettings = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(loadSettings);
  const [parts, setParts] = useState(loadMasterParts);
  const [partsSaveFailed, setPartsSaveFailed] = useState(false);

  const persist = (next) => {
    const ok = saveSettings(next);
    if (ok) setSettings(next);
    return ok;
  };

  return (
    <main className="sp-page sset-page">
      <div className="sp-header">
        <div className="sp-heading">
          <h2 className="sp-title">{t("shiftSettings.title")}</h2>
          <p className="sp-subtitle">{t("shiftSettings.subtitle")}</p>
        </div>
      </div>

      <div className="sset-row">
        <LineCapacityCard
          capacity={settings.capacity}
          shiftTimes={settings.shiftTimes}
          onSave={(capacity) => persist({ ...settings, capacity })}
        />
        <WorkingTimesCard
          workingDays={settings.workingDays}
          shiftTimes={settings.shiftTimes}
          onSave={(draft) => persist({ ...settings, ...draft })}
        />
      </div>

      <div>
        <PartMasterCard
          parts={parts}
          onChange={(next) => {
            setParts(next);
            setPartsSaveFailed(!saveMasterParts(next));
          }}
        />
        {partsSaveFailed && <p className="splan-notice splan-notice--warn sset-message">{t("shiftSettings.partsSaveFailed")}</p>}
      </div>
    </main>
  );
};

export default ShiftSettings;
