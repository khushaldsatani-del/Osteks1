import React, { useState } from "react";
import Segmented from "../common/Segmented";
import CalcRow from "../common/CalcRow";
import KeySection from "../common/KeySection";
import { decimal, eur, num, pct } from "../../engine/format";
import { useT } from "../../i18n/languageContext";

// Calculation details for KTL: every line of the sheet in two tabs -
// the machine-hour calculation (columns D-G) and the key figures around it
// (column A-B results and the cost-table rates).
const KtlResult = ({ result, settings }) => {
  const { t } = useT();
  const [tab, setTab] = useState("machine");
  const m = result.machine;
  const k = (key, vars) => t(`result.ktl.${key}`, vars);
  const noStaff = t("result.noStaffCosts");

  const rowLabel = (key) => {
    if (key === "paint") return k("paint", { paint: m.paint });
    if (key === "pretreat") {
      return m.pretreatKind === "Beizen"
        ? k("pickling", { rate: decimal(settings.pretreatBeizen) })
        : k("pretreat", { rate: decimal(settings.pretreatNormal) });
    }
    if (key === "overhead") return k("overhead", { pct: pct(settings.overhead, 0) });
    if (key === "etz") return k("etz", { pct: pct(settings.etz) });
    return k(key);
  };

  return (
    <div className="result">
      <Segmented
        size="sm"
        label={t("result.view")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "machine", label: k("tabMachine") },
          { value: "info", label: k("tabInfo") },
        ]}
      />

      <div className="result-body">
        {tab === "machine" && (
          <>
            <div className="crows crows--compact">
              <CalcRow label={k("machineRate")} cell="F8" value={eur(m.machineRate)} />
              <CalcRow label={k("carriersPerHour")} cell="F9" value={num(m.carriersPerHour, 2)} />
              <CalcRow label={k("machinePerCarrier")} cell="F10" value={eur(m.machinePerCarrier)} />
              <CalcRow label={k("staffPerCarrier")} cell="F11" value={eur(m.staffPerCarrier)} />
            </div>
            <div className="crows">
              <div className="crow crow--head">
                <span className="crow-label">{t("result.costPerPart")}</span>
                <span className="crow-share">{t("result.share")}</span>
                <span className="crow-value">{t("result.amount")}</span>
              </div>
              {m.rows.map((row) => (
                <CalcRow key={row.key} label={rowLabel(row.key)} cell={row.cell} share={pct(row.share)} value={eur(row.value)} strong={row.strong} />
              ))}
              <CalcRow label={k("price")} cell="F32" share="100 %" value={m.price == null ? noStaff : eur(m.price)} strong />
            </div>
          </>
        )}

        {tab === "info" && (
          <>
            <KeySection title={k("secLine")}>
              <CalcRow label={k("area")} cell="C3" value={`${num(result.areaM2, 4)} m²`} />
              <CalcRow label={k("minutesPerCarrier")} cell="F4" value={`${num(m.minutesPerCarrier, 1)} min`} />
              <CalcRow label={k("utilisation")} cell="F5" value={pct(m.utilisation, 0)} />
            </KeySection>
            <KeySection title={k("secRevenue")}>
              <CalcRow label={k("weightPerCarrier")} cell="B20" value={`${num(result.weightPerCarrier, 2)} kg`} />
              <CalcRow label={k("revenuePerCarrier")} cell="B21" value={eur(result.revenuePerCarrier, 2)} />
              <CalcRow label={k("revenuePerM2")} cell="B22" value={eur(result.revenuePerM2, 2)} />
              <CalcRow label={k("revenuePerYear")} cell="B23" value={eur(result.revenuePerYear, 2)} strong />
            </KeySection>
            <KeySection title={k("secTable")} note={k("secTableNote")}>
              <CalcRow label={k("ratePerCarrierTable")} cell="L25" value={eur(result.table.ratePerUnit.ktl)} />
              <CalcRow label={k("variablePerCarrier")} cell="L26" value={eur(result.table.variablePerUnit.ktl)} />
              <CalcRow label={k("sumPerCarrier")} cell="L27" value={eur(result.table.sumPerUnit.ktl)} strong />
            </KeySection>
          </>
        )}
      </div>
    </div>
  );
};

export default KtlResult;
