import React from "react";
import FieldGroup from "../common/FieldGroup";
import { Euro, Layers, MessageSquareText, Package, Ruler, SlidersHorizontal, Users } from "lucide-react";
import Field from "../common/Field";
import YesNo from "../common/YesNo";
import Segmented from "../common/Segmented";
import { num } from "../../engine/format";
import { useT } from "../../i18n/languageContext";

// The KTL part as one calm card: what the part is, its surface, how it is
// coated, and the staff time - only what changes per part. Values that
// keep their default (wage, time per carrier) sit under "Weitere Werte",
// always shown (user's choice) above the remark.
const KtlPartForm = ({ part, result, settings, onChange }) => {
  const { t } = useT();
  const set = (key) => (value) => onChange({ [key]: value });
  // a value the calculation cannot use (negative, or 0 where it divides)
  const bad = (key) => !!result.invalid?.includes(key);
  const pcs = t("units.pcs");
  const changed = ["wagePerHour", "minutesPerCarrier"].filter((k) => part[k] != null && part[k] !== "").length;

  return (
    <div className="form-card">
      <FieldGroup title={t("box.part")} icon={Package}>
        <Field label={t("ktl.name")} value={part.name} onChange={set("name")} invalid={bad("name")} numeric={false} wide />
        <Field label={t("ktl.drawingNo")} value={part.drawingNo} onChange={set("drawingNo")} invalid={bad("drawingNo")} numeric={false} />
        <Field label={t("ktl.paintSpec")} value={part.paintSpec} onChange={set("paintSpec")} invalid={bad("paintSpec")} numeric={false} />
        <Field label={t("ktl.quantity")} cell="B2" unit={pcs} value={part.quantity} onChange={set("quantity")} invalid={bad("quantity")} />
        <Field label={t("ktl.layer")} cell="B5" value={part.layer} onChange={set("layer")} invalid={bad("layer")} numeric={false} />
      </FieldGroup>

      <FieldGroup
        title={t("box.surface")} icon={Ruler}
        aside={
          result.areaFromWeight ? (
            <button type="button" className="link-btn" onClick={() => onChange({ surfaceMm2: String(Math.round(result.areaFromWeight)) })}>
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

      <FieldGroup title={t("box.process")} icon={Layers} cols={4}>
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

      <FieldGroup title={t("box.staff")} icon={Users}>
        <Field label={t("ktl.loadMinutes")} cell="B11" unit="min" value={part.loadMinutes} onChange={set("loadMinutes")} invalid={bad("loadMinutes")} />
        <Field label={t("ktl.workers")} cell="B12" value={part.workers} onChange={set("workers")} invalid={bad("workers")} />
      </FieldGroup>
      {(result.missing?.includes("loadMinutes") || result.missing?.includes("workers")) && <p className="hint-line">{t("ktl.noStaff")}</p>}

      <FieldGroup
        title={t("form.moreValues")}
        icon={SlidersHorizontal}
        cols={4}
        aside={changed > 0 ? <span className="more-count">{t("form.changed", { n: changed })}</span> : null}
      >
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

      <FieldGroup title={t("box.oneTime")} icon={Euro}>
        <Field label={t("ktl.testCost")} unit="€" value={part.testCost ?? ""} onChange={set("testCost")} />
        <Field label={t("ktl.rackCost")} unit="€" value={part.rackCost ?? ""} onChange={set("rackCost")} />
      </FieldGroup>

      <FieldGroup title={t("box.remark")} icon={MessageSquareText} cols={1}>
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
