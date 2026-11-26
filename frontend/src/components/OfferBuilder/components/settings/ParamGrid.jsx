import React from "react";
import NumCell from "./NumCell";
import { useT } from "../../i18n/languageContext";

// A list of named values with their Excel cell - the KTL part parameters
// and the Pulver "Kalkulationsvorgaben (nicht ändern!)". Labels and notes
// are dictionary keys (settings.param.*, settings.note.*). Every row has
// the same three columns - label, value, unit - so the boxes line up.
const ParamGrid = ({ items, values, onChange }) => {
  const { t } = useT();
  return (
    <div className="param-grid">
      {items.map(({ key, labelKey, cell, unit, percent, note }) => {
        const label = t(`settings.param.${labelKey ?? key}`);
        return (
          <div key={key} className="param">
            <span className="param-label">
              {label}
              <em className="cellref">{cell}</em>
              {note && <small>{t(`settings.note.${note}`)}</small>}
            </span>
            <NumCell value={values[key]} percent={percent} percentSign={false} onChange={(v) => onChange({ [key]: v })} label={label} width="100%" />
            <em className="param-unit">{percent ? "%" : unit ?? ""}</em>
          </div>
        );
      })}
    </div>
  );
};

export default ParamGrid;
