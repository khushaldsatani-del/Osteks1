import React from "react";
import Segmented from "./Segmented";
import { useT } from "../../i18n/languageContext";

// The sheets' "j/n" questions (Beizen, Gußteil) as a Yes / No switch.
const YesNo = ({ label, cell, value, onChange }) => {
  const { t } = useT();
  return (
    <div className="fld" title={cell ? `Excel: ${cell}` : undefined}>
      <span className="fld-label">{label}</span>
      <Segmented
        size="field"
        label={label}
        value={value ? "j" : "n"}
        onChange={(v) => onChange(v === "j")}
        options={[
          { value: "j", label: t("common.yes") },
          { value: "n", label: t("common.no") },
        ]}
      />
    </div>
  );
};

export default YesNo;
