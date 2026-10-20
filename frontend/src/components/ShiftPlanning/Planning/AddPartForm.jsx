import React, { useState } from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { PLAN_LINES } from "./planningData";

// Inline form for "Add Part (No Order)": a part that is coated without a
// customer order. Teil-Nr. is required and must not already be planned.
const AddPartForm = ({ existingParts, onAdd, onCancel }) => {
  const { t } = useTranslation();
  const [part, setPart] = useState("");
  const [name, setName] = useState("");
  const [line, setLine] = useState(PLAN_LINES[0].id);
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const partNo = part.trim();
    if (!partNo) {
      setError(t("shiftPlan.partNoRequired"));
      return;
    }
    if (existingParts.some((p) => p.part.toLowerCase() === partNo.toLowerCase())) {
      setError(t("shiftPlan.partExists", { part: partNo }));
      return;
    }
    const parsedPrice = Number(price.replace(",", "."));
    onAdd({ part: partNo, name: name.trim(), line, price: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0 });
  };

  return (
    <form className="splan-add" onSubmit={submit} noValidate>
      <p className="splan-add-title">{t("shiftPlan.addPartTitle")}</p>
      <div className="splan-add-fields">
        <label className="splan-field">
          <span>{t("shiftPlan.colPartNo")} *</span>
          <input
            value={part}
            onChange={(event) => {
              setPart(event.target.value);
              setError("");
            }}
            aria-invalid={!!error}
            autoFocus
          />
        </label>
        <label className="splan-field">
          <span>{t("shiftPlan.fieldName")}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="splan-field splan-field--small">
          <span>{t("shiftPlan.colLine")}</span>
          <select value={line} onChange={(event) => setLine(event.target.value)}>
            {PLAN_LINES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="splan-field splan-field--small">
          <span>{t("shiftPlan.colPrice")}</span>
          <input value={price} inputMode="decimal" onChange={(event) => setPrice(event.target.value.replace(/[^\d.,]/g, ""))} />
        </label>
        <div className="splan-add-actions">
          <button type="button" className="splan-btn" onClick={onCancel}>
            {t("shiftPlan.cancel")}
          </button>
          <button type="submit" className="splan-btn splan-btn--solid">
            {t("shiftPlan.add")}
          </button>
        </div>
      </div>
      {error && (
        <p className="splan-add-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
};

export default AddPartForm;
