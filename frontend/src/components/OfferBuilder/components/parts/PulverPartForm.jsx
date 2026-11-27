import React from "react";
import FieldGroup from "../common/FieldGroup";
import Field from "../common/Field";
import { MATERIALS } from "../../engine/defaults";
import { decimal, eur, num } from "../../engine/format";
import { useT } from "../../i18n/languageContext";
import { isAutoSurface, surfaceFromWeight } from "../../state/autoSurface";

// The Pulver part as one card, in the order of the sheet: what the part
// is, its surface, quantity and powder, how it hangs on the chain, the
// staff (for information), the price without material it leads to (B29),
// then the masking extras. Defaults show as placeholders - an empty field
// uses the calculation setting.
const PulverPartForm = ({ part, result, settings, offer, onChange, onOffer, onCustomer }) => {
  const { t } = useT();
  const set = (key) => (value) => onChange({ [key]: value });
  // a value the calculation cannot use (negative, or 0 where it divides)
  const bad = (key) => !!result.invalid?.includes(key);
  const fromWeight = result.areaFromWeight;

  return (
    <div className="form-card">
      <FieldGroup title={t("box.part")} cols={4}>
        <Field label={t("pulver.name")} value={part.name} onChange={set("name")} invalid={bad("name")} numeric={false} wide />
        <Field label={t("pulver.customer")} cell="A5" value={offer.customer.company} onChange={(v) => onCustomer({ company: v })} numeric={false} />
        <Field label={t("pulver.requestDate")} cell="A6" value={offer.requestDate} onChange={(v) => onOffer({ requestDate: v })} numeric={false} type="date" />
        <Field label={t("pulver.description")} cell="A7" value={part.description} onChange={set("description")} invalid={bad("description")} numeric={false} wide />
        <Field label={t("pulver.customerNo")} cell="A8" value={part.customerArticleNo} onChange={set("customerArticleNo")} invalid={bad("customerArticleNo")} numeric={false} />
        <Field label={t("pulver.osteksNo")} cell="A9" value={part.osteksArticleNo} onChange={set("osteksArticleNo")} invalid={bad("osteksArticleNo")} numeric={false} />
      </FieldGroup>

      <FieldGroup
        title={t("box.surface")}
        aside={
          // the surface fills itself from the weight; the link is only
          // offered when a typed-in surface differs from it
          fromWeight && !isAutoSurface("pulver", part) && String(part.surfaceCm2 ?? "") !== surfaceFromWeight("pulver", part, settings) ? (
            <button type="button" className="link-btn" onClick={() => onChange({ surfaceCm2: surfaceFromWeight("pulver", part, settings), surfaceAuto: true })}>
              {t("form.useFromWeightPulver", { cm2: num(fromWeight / 100, 0), mm2: num(fromWeight, 0) })}
            </button>
          ) : null
        }
      >
        <label className="fld" title="Excel: B16">
          <span className="fld-label">{t("pulver.material")}</span>
          <span className="fld-box">
            <select value={part.material ?? "steel"} onChange={(event) => onChange({ material: event.target.value })}>
              {MATERIALS.map((m) => (
                <option key={m.key} value={m.key}>
                  {t(`materials.${m.key}`)} · {decimal(m.density ?? settings.densitySteel)} g/cm³
                </option>
              ))}
            </select>
          </span>
        </label>
        <Field label={t("pulver.weight")} cell="B14" unit="g" value={part.weightG} onChange={set("weightG")} invalid={bad("weightG")} />
        <Field label={t("pulver.thickness")} cell="B15" unit="mm" value={part.thicknessMm} onChange={set("thicknessMm")} invalid={bad("thicknessMm")} />
        <Field
          label={t("pulver.surfaceFromWeight")}
          cell="B17"
          unit="mm²"
          value={fromWeight ? num(fromWeight, 0) : "–"}
          hint={t("pulver.bothSides")}
          readOnly
        />
        <Field label={t("pulver.surface")} cell="B20" unit="cm²" value={part.surfaceCm2} onChange={set("surfaceCm2")} invalid={bad("surfaceCm2")} hint={t("pulver.surfaceUsed")} />
      </FieldGroup>

      <FieldGroup title={t("box.quantityPowder")}>
        <Field label={t("pulver.quantity")} cell="B10" unit={t("units.pcs")} value={part.quantity} onChange={set("quantity")} invalid={bad("quantity")} />
        <Field label={t("pulver.powderPrice")} cell="B21" unit="€/kg" value={part.powderPricePerKg} onChange={set("powderPricePerKg")} invalid={bad("powderPricePerKg")} />
        <Field label={t("pulver.layer")} cell="B19" unit="µm" value={part.layerUm ?? ""} placeholder={String(settings.layerUm)} onChange={set("layerUm")} invalid={bad("layerUm")} />
      </FieldGroup>

      <FieldGroup title={t("box.hangingChain")}>
        <Field label={t("pulver.length")} cell="B23" unit="m" value={part.partLengthM} onChange={set("partLengthM")} invalid={bad("partLengthM")} />
        <Field label={t("pulver.perHook")} cell="B24" value={part.partsPerHook} onChange={set("partsPerHook")} invalid={bad("partsPerHook")} />
        <Field
          label={t("pulver.hooksPerMetre")}
          cell="B25"
          value={part.partLengthM && result.hooksPerMetre != null ? num(result.hooksPerMetre, 2) : ""}
          placeholder="–"
          hint={t("pulver.hooksAuto")}
          readOnly
        />
        <Field label={t("pulver.speed")} cell="B26" unit="m/min" value={part.chainSpeed ?? ""} placeholder={String(settings.chainSpeed)} onChange={set("chainSpeed")} invalid={bad("chainSpeed")} />
        <Field label={t("pulver.gap")} cell="D24" unit="m" value={part.gapMetres ?? ""} placeholder={String(settings.gapMetres)} onChange={set("gapMetres")} invalid={bad("gapMetres")} />
      </FieldGroup>

      <FieldGroup title={t("box.staffPulver")} aside={<span className="group-note">{t("form.notInPrice")}</span>}>
        <Field label={t("pulver.workers")} cell="H18" value={part.workers ?? ""} placeholder={String(settings.workers)} onChange={set("workers")} invalid={bad("workers")} />
        <Field label={t("pulver.wage")} cell="H19" unit="€/h" value={part.wagePerHour ?? ""} placeholder={String(settings.wagePerHour)} onChange={set("wagePerHour")} invalid={bad("wagePerHour")} />
      </FieldGroup>

      <div className="form-result" title="Excel: B29 = H8 / H10">
        <span>{t("pulver.priceWithoutMaterial")}</span>
        <strong>{eur(result.priceWithoutMaterial, 4)}</strong>
      </div>

      <FieldGroup title={t("box.masking")}>
        <Field label={t("pulver.plugs")} cell="B30" value={part.plugs} onChange={set("plugs")} invalid={bad("plugs")} />
        <Field label={t("pulver.tapes")} cell="B31" value={part.tapes} onChange={set("tapes")} invalid={bad("tapes")} />
      </FieldGroup>
    </div>
  );
};

export default PulverPartForm;
