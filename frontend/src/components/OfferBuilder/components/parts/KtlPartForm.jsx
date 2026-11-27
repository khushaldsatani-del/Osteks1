import React from "react";
import FieldGroup from "../common/FieldGroup";
import Field from "../common/Field";
import YesNo from "../common/YesNo";
import Segmented from "../common/Segmented";
import { num } from "../../engine/format";
import { useT } from "../../i18n/languageContext";
import { isAutoSurface, surfaceFromWeight } from "../../state/autoSurface";

// The KTL part as one calm card: what the part is, its surface, how it is
// coated, and the staff time - only what changes per part. Wage and time
// per carrier keep their default unless typed in; they sit with the staff
// values (the user merged "Weitere Werte" into "Personal & Takt").
const KtlPartForm = ({ part, result, settings, onChange }) => {
  const { t } = useT();
  const set = (key) => (value) => onChange({ [key]: value });
  // a value the calculation cannot use (negative, or 0 where it divides)
  const bad = (key) => !!result.invalid?.includes(key);
  const pcs = t("units.pcs");
  const fromWeight = surfaceFromWeight("ktl", part, settings);

  return (
    <div className="form-card">
      <FieldGroup title={t("box.part")}>
        <Field label={t("ktl.name")} value={part.name} onChange={set("name")} invalid={bad("name")} numeric={false} wide />
        <Field label={t("ktl.drawingNo")} value={part.drawingNo} onChange={set("drawingNo")} invalid={bad("drawingNo")} numeric={false} />
        <Field label={t("ktl.paintSpec")} value={part.paintSpec} onChange={set("paintSpec")} invalid={bad("paintSpec")} numeric={false} />
        <Field label={t("ktl.quantity")} cell="B2" unit={pcs} value={part.quantity} onChange={set("quantity")} invalid={bad("quantity")} />
        <Field label={t("ktl.layer")} cell="B5" value={part.layer} onChange={set("layer")} invalid={bad("layer")} numeric={false} />
      </FieldGroup>

      <FieldGroup
        title={t("box.surface")}
        aside={
          // the surface fills itself from the weight; the link is only
          // offered when a typed-in surface differs from it
          fromWeight != null && !isAutoSurface("ktl", part) && String(part.surfaceMm2 ?? "") !== fromWeight ? (
            <button type="button" className="link-btn" onClick={() => onChange({ surfaceMm2: fromWeight, surfaceAuto: true })}>
              {t("form.useFromWeight", { value: `${num(result.areaFromWeight, 0)} mm²` })}
            </button>
          ) : null
        }
      >
        <Field
          label={t("ktl.surface")}
          cell="B3"
          unit="mm²"
          value={part.surfaceMm2}
          onChange={set("surfaceMm2")} invalid={bad("surfaceMm2")}
          hint={`${num(result.areaM2, 4)} m²`}
        />
        <Field label={t("ktl.weight")} cell="B4" unit="g" value={part.weightG} onChange={set("weightG")} invalid={bad("weightG")} />
        <Field label={t("ktl.thickness")} cell="B14" unit="mm" value={part.thicknessMm} onChange={set("thicknessMm")} invalid={bad("thicknessMm")} />
      </FieldGroup>

      <FieldGroup title={t("box.process")} cols={4}>
        <YesNo label={t("ktl.beizen")} cell="B8" value={part.beizen} onChange={set("beizen")} invalid={bad("beizen")} />
        <YesNo label={t("ktl.guss")} cell="B9" value={part.guss} onChange={set("guss")} invalid={bad("guss")} />
        <div className="fld" title="Excel: E21">
          <span className="fld-label">{t("ktl.paint")}</span>
          <Segmented
            size="field"
            label={t("ktl.paint")}
            value={part.paint}
            onChange={set("paint")} invalid={bad("paint")}
            options={[
              { value: "D-KTL", label: "D-KTL" },
              { value: "N-KTL", label: "N-KTL" },
            ]}
          />
        </div>
        <Field label={t("ktl.masking")} cell="B10" value={part.maskingPoints} onChange={set("maskingPoints")} invalid={bad("maskingPoints")} />
      </FieldGroup>

      <FieldGroup title={t("box.staff")} cols={4}>
        <Field label={t("ktl.loadMinutes")} cell="B11" unit="min" value={part.loadMinutes} onChange={set("loadMinutes")} invalid={bad("loadMinutes")} />
        <Field label={t("ktl.workers")} cell="B12" value={part.workers} onChange={set("workers")} invalid={bad("workers")} />
        <Field label={t("ktl.wage")} cell="B13" unit="€/h" value={part.wagePerHour ?? ""} placeholder={String(settings.wagePerHour)} onChange={set("wagePerHour")} invalid={bad("wagePerHour")} />
        <Field
          label={t("ktl.minutesPerCarrier")}
          cell="F4"
          unit="min"
          value={part.minutesPerCarrier ?? ""}
          placeholder={String(settings.minutesPerCarrier)}
          onChange={set("minutesPerCarrier")} invalid={bad("minutesPerCarrier")}
        />
      </FieldGroup>
      {(result.missing?.includes("loadMinutes") || result.missing?.includes("workers")) && <p className="hint-line">{t("ktl.noStaff")}</p>}

      <FieldGroup title={t("box.oneTime")}>
        <Field label={t("ktl.testCost")} unit="€" value={part.testCost ?? ""} onChange={set("testCost")} />
        <Field label={t("ktl.rackCost")} unit="€" value={part.rackCost ?? ""} onChange={set("rackCost")} />
      </FieldGroup>

      <FieldGroup title={t("box.remark")} cols={1}>
        <label className="fld" title="Excel: A35">
          <span className="fld-box fld-box--area">
            <textarea
              rows={3}
              value={part.remark ?? ""}
              onChange={(event) => set("remark")(event.target.value)}
              placeholder={t("ktl.remarkHint")}
              aria-label={t("box.remark")}
            />
          </span>
        </label>
      </FieldGroup>
    </div>
  );
};

export default KtlPartForm;
