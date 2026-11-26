import React, { useMemo, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import Segmented from "../common/Segmented";
import KtlCostTable from "./KtlCostTable";
import KtlVariableTable from "./KtlVariableTable";
import ParamGrid from "./ParamGrid";
import FormulaList from "./FormulaList";
import { costTable } from "../../engine/ktl";
import { eur } from "../../engine/format";
import { useT } from "../../i18n/languageContext";

// value key, Excel cell, unit, % or not, and a note to confirm in the
// meeting - the label is settings.param.<key> (or labelKey)
const KTL_PARAMS = [
  { key: "carrierSurfaceM2", cell: "B6", unit: "m²" },
  { key: "minutesPerCarrier", cell: "F4", unit: "min" },
  { key: "utilisation", cell: "F5", percent: true },
  { key: "wagePerHour", cell: "B13", unit: "€" },
  { key: "overhead", cell: "E28", percent: true },
  { key: "etz", cell: "B30", percent: true },
  { key: "paintDktl", cell: "H2 / F21", unit: "€/m²", note: "alsoB26" },
  { key: "paintNktlFormula", cell: "F21", unit: "€/m²", note: "h3Shows" },
  { key: "paintNktlTable", cell: "H3", unit: "€/m²", note: "notCalculated" },
  { key: "pretreatNormal", cell: "F22", unit: "€/m²", note: "textSays010" },
  { key: "pretreatBeizen", cell: "F22", unit: "€/m²" },
  { key: "maskingPerPoint", cell: "B27", unit: "€" },
  { key: "castingSurcharge", cell: "B17", percent: true },
  { key: "basePerCarrier", cell: "B25", unit: "€" },
  { key: "basePerPart", cell: "B25", unit: "€" },
  { key: "densitySteel", cell: "B15", unit: "g/cm³" },
];

const PULVER_PARAMS = [
  { key: "usefulHoursPerShift", cell: "H6", unit: "h" },
  { key: "targetBase", cell: "H23", unit: "€/h" },
  { key: "targetFactor", cell: "H23", percent: true },
  { key: "materialShare", cell: "H24", percent: true, note: "displayOnly" },
  { key: "machineRate", cell: "H16", unit: "€/h", note: "infoOnly" },
  { key: "workers", cell: "H18", note: "infoOnly" },
  { key: "wagePerHour", labelKey: "pulverWage", cell: "H19", unit: "€", note: "infoOnly" },
  { key: "chainSpeed", cell: "B26 / H25", unit: "m/min" },
  { key: "gapMetres", cell: "D24", unit: "m" },
  { key: "layerUm", cell: "B19", unit: "µm" },
  { key: "powderDensity", cell: "H26", unit: "g/cm³" },
  { key: "transferEfficiency", cell: "H27 (0,95)", percent: true },
  { key: "coatingHeight", cell: "B22", unit: "m", note: "inNoFormula" },
  { key: "pricePerPlug", cell: "E30", unit: "€" },
  { key: "pricePerTape", cell: "E31", unit: "€" },
  { key: "etz", cell: "B36", percent: true },
  { key: "densitySteel", cell: "B16", unit: "g/cm³" },
];

// The fixed values of both sheets in one drawer, so no Excel has to be
// opened: KTL's cost table with the machine-hour rate, its variable costs
// and part parameters, and Pulver's "Kalkulationsvorgaben". Changing a
// value recalculates every part at once.
const SettingsDrawer = ({ settings, process, onChange, onReset, onClose }) => {
  const { t } = useT();
  const [tab, setTab] = useState(process === "ktl" ? "ktlCosts" : "pulver");
  const table = useMemo(() => costTable(settings.ktl), [settings.ktl]);
  const changeKtl = (changes) => onChange("ktl", changes);
  const changePulver = (changes) => onChange("pulver", changes);
  const forProcess = tab.startsWith("pulver") ? "pulver" : "ktl";

  return (
    <div className="layer">
      <button type="button" className="layer-backdrop" aria-label={t("common.close")} tabIndex={-1} onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={t("settings.title")}>
        <header className="drawer-head">
          <div>
            <h2>{t("settings.title")}</h2>
            <p>{t("settings.subtitle")}</p>
          </div>
          <div className="drawer-key">
            <span>{t("settings.keyRate")}</span>
            <strong>{eur(table.rate.ktl)}</strong>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </header>

        <div className="drawer-tabs">
          <Segmented
            size="sm"
            label={t("settings.area")}
            value={tab}
            onChange={setTab}
            options={[
              { value: "ktlCosts", label: t("settings.tabCosts") },
              { value: "ktlVariable", label: t("settings.tabVariable") },
              { value: "ktlParams", label: t("settings.tabParams") },
              { value: "ktlFormulas", label: t("settings.formulas.tabKtl") },
              { value: "pulver", label: t("settings.tabPulver") },
              { value: "pulverFormulas", label: t("settings.formulas.tabPulver") },
            ]}
          />
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => onReset(forProcess)}>
            <RotateCcw size={13} />
            {t("settings.reset", { process: t(`process.${forProcess}`) })}
          </button>
        </div>

        <div className="drawer-body">
          {tab === "ktlCosts" && <KtlCostTable s={settings.ktl} table={table} onChange={changeKtl} />}
          {tab === "ktlVariable" && <KtlVariableTable s={settings.ktl} table={table} onChange={changeKtl} />}
          {tab === "ktlParams" && <ParamGrid items={KTL_PARAMS} values={settings.ktl} onChange={changeKtl} />}
          {tab === "pulver" && <ParamGrid items={PULVER_PARAMS} values={settings.pulver} onChange={changePulver} />}
          {tab === "ktlFormulas" && <FormulaList process="ktl" settings={settings.ktl} table={table} />}
          {tab === "pulverFormulas" && <FormulaList process="pulver" settings={settings.pulver} table={table} />}
        </div>
      </aside>
    </div>
  );
};

export default SettingsDrawer;
