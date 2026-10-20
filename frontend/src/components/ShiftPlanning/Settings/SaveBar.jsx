import React from "react";
import { Info } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";

// Bottom row of a settings card: an optional hint on the left, the save
// state and the Save button on the right. Save is enabled only when there
// is something to save and nothing invalid.
const SaveBar = ({ hint, dirty, invalid, status, onSave }) => {
  const { t } = useTranslation();
  const state = status === "failed" ? "failed" : dirty ? "dirty" : status === "saved" ? "saved" : null;

  return (
    <div className="sset-savebar">
      {hint && (
        <p className="sset-hint">
          <Info size={14} />
          {hint}
        </p>
      )}
      <div className="sset-savebar-right">
        {state && (
          <span className={`sset-save-state sset-save-state--${state}`} aria-live="polite">
            {t(`shiftSettings.state_${state}`)}
          </span>
        )}
        <button type="button" className="splan-btn splan-btn--solid sset-save" onClick={onSave} disabled={!dirty || invalid}>
          {t("shiftSettings.save")}
        </button>
      </div>
    </div>
  );
};

export default SaveBar;
