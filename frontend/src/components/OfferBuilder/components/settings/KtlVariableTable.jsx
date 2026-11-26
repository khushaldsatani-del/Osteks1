import React from "react";
import NumCell from "./NumCell";
import { eur, num } from "../../engine/format";
import { useT } from "../../i18n/languageContext";

// The sheet's variable costs (V5:AD22): per year, per hour and per carrier
// (KTL) or metre of chain (Pulver). Shown as in the sheet - note they are
// not part of the KTL price (F21:F32).
const KtlVariableTable = ({ s, table, onChange }) => {
  const { t } = useT();
  const setCost = (id, key, value) => onChange({ variableCosts: s.variableCosts.map((c) => (c.id === id ? { ...c, [key]: value } : c)) });
  const col = (key) => t(`settings.col.${key}`);
  const share = (c, key, line) => (
    <NumCell value={c[key]} percent onChange={(v) => setCost(c.id, key, v)} label={t("settings.shareOf", { name: t(`settings.costs.${c.id}`), line })} width={70} />
  );

  return (
    <>
      <p className="set-note">{t("settings.variableNote")}</p>
      <table className="set-table">
        <thead>
          <tr>
            <th>{col("varName")}</th>
            <th className="r">{col("varAmount")}</th>
            <th className="r">{col("varKtl")}</th>
            <th className="r">{col("varPulver")}</th>
            <th className="r">{col("varSchaeumen")}</th>
            <th className="r">{col("ktlHour")}</th>
            <th className="r">{col("ktlPerCarrier")}</th>
            <th className="r">{col("pulverPerMetre")}</th>
            <th className="r">{col("schaeumen")}</th>
          </tr>
        </thead>
        <tbody>
          {table.variable.map((c) => {
            const name = t(`settings.costs.${c.id}`);
            return (
              <tr key={c.id}>
                <td>
                  {name} <em className="cellref">{c.row}</em>
                </td>
                <td className="r">
                  <NumCell value={c.amount} onChange={(v) => setCost(c.id, "amount", v)} label={t("settings.amountOf", { name })} width={110} />
                </td>
                <td className="r">{share(c, "ktl", "KTL")}</td>
                <td className="r">{share(c, "pulver", t("process.pulver"))}</td>
                <td className="r">{share(c, "schaeumen", t("process.schaeumen"))}</td>
                <td className="r">{num(c.ktlHour, 2)}</td>
                <td className="r">{num(c.ktlPerUnit, 2)}</td>
                <td className="r">{num(c.pulverPerUnit, 4)}</td>
                <td className="r">{num(c.schaeumenPerUnit, 4)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="is-key">
            <td>{t("settings.row.variableSum")}</td>
            <td colSpan={5} />
            <td className="r">{eur(table.variablePerUnit.ktl)}</td>
            <td className="r">{eur(table.variablePerUnit.pulver)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </>
  );
};

export default KtlVariableTable;
