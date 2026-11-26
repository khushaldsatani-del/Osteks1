import React, { useState } from "react";
import Segmented from "../common/Segmented";
import CalcRow from "../common/CalcRow";
import KeySection from "../common/KeySection";
import { eur, num, pct } from "../../engine/format";
import { useT } from "../../i18n/languageContext";

// Calculation details for Pulver: the sheet's right-hand block (column G-H)
// in two tabs - the line, its figures and staff, then the target revenue and
// the powder. The price itself is on the card and the form, so it is not
// repeated here.
const PulverResult = ({ result, settings }) => {
  const { t } = useT();
  const r = result;
  const k = (key, vars) => t(`result.pulver.${key}`, vars);
  const minutes = r.runtimeMinutes;
  const [tab, setTab] = useState("line");

  return (
    <div className="result">
      <Segmented
        size="sm"
        label={t("result.view")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "line", label: k("tabLine") },
          { value: "material", label: k("tabMaterial") },
        ]}
      />

      <div className="result-body">
        {tab === "line" && (
          <>
            <KeySection title={k("secDefaults")}>
              <CalcRow label={k("usefulHours")} cell="H6" value={`${num(settings.usefulHoursPerShift, 1)} h`} />
              <CalcRow label={k("perShift")} cell="H7" value={eur(r.perShift, 2)} />
              <CalcRow label={k("perHour")} cell="H8" value={eur(r.target, 2)} />
            </KeySection>

            <KeySection title={k("secInfo")}>
              <CalcRow label={k("partsPerHour")} cell="H10" value={num(r.partsPerHour, 1)} />
              <CalcRow label={k("runtime")} cell="H11" value={minutes == null ? "–" : k("runtimeValue", { min: num(minutes, 0), h: num(minutes / 60, 1) })} />
              <CalcRow label={k("revenueForQty")} cell="H12" value={eur(r.revenueForQty, 2)} strong />
            </KeySection>

            <KeySection title={k("secMachine")} note={t("form.notInPrice")}>
              <CalcRow label={k("machineRate")} cell="H16" value={eur(settings.machineRate, 2)} />
              <CalcRow label={k("machinePerPart")} cell="H17" value={eur(r.machinePerPart)} />
              <CalcRow label={k("workers")} cell="H18" value={num(r.workers)} />
              <CalcRow label={k("wage")} cell="H19" value={eur(r.wage, 2)} />
              <CalcRow label={k("wagePerPart")} cell="H20" value={eur(r.wagePerPart)} strong />
            </KeySection>
          </>
        )}

        {tab === "material" && (
          <>
            <KeySection title={k("secTarget")}>
              <CalcRow label={k("target")} cell="H23" value={eur(r.target, 2)} strong />
              <CalcRow label={k("materialShareNormal")} cell="H24" value={pct(settings.materialShare, 0)} />
              <CalcRow label={k("speed")} cell="H25" value={`${num(r.speed, 2)} m/min`} />
            </KeySection>

            <KeySection title={k("secPowder")}>
              <CalcRow label={k("powderDensity")} cell="H26" value={`${num(settings.powderDensity, 2)} g/cm³`} />
              <CalcRow label={k("powderPerPart")} cell="H27" value={`${num(r.gramsPerPart, 2)} g`} />
              <CalcRow label={k("materialPerPart")} cell="H28" value={eur(r.materialCost)} strong />
              <CalcRow label={k("materialPerShift")} cell="H30" value={`${num(r.materialPerShiftKg, 2)} kg`} />
            </KeySection>
          </>
        )}
      </div>
    </div>
  );
};

export default PulverResult;
