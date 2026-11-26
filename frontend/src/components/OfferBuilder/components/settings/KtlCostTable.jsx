import React from "react";
import NumCell from "./NumCell";
import { eur, num, pct } from "../../engine/format";
import { useT } from "../../i18n/languageContext";

// The sheet's cost block (I5:P27): the 2025 fixed costs split over KTL,
// Pulver and Schäumen, the hours each line works a year, and from that the
// machine-hour rate - the number the KTL price is built on.
const KtlCostTable = ({ s, table, onChange }) => {
  const { t } = useT();
  const setCost = (id, key, value) => onChange({ fixedCosts: s.fixedCosts.map((c) => (c.id === id ? { ...c, [key]: value } : c)) });
  const col = (key) => t(`settings.col.${key}`);
  const row = (key) => t(`settings.row.${key}`);

  const hourFields = [
    ["hoursPerShift", false],
    ["workingDays", false],
    ["availability", true],
    ["shiftsKtl", false],
    ["shiftsPulver", false],
    ["shiftsSchaeumen", false],
    ["carriersPerHour", false, "carriersPerHourTable"],
    ["chainPerHour", false, "chainMetresPerHour"],
  ];

  return (
    <div className="set-split">
      <table className="set-table">
        <thead>
          <tr>
            <th>{col("name")}</th>
            <th className="r">{col("amount")}</th>
            <th className="r">{col("ktlPct")}</th>
            <th className="r">{col("pulverPct")}</th>
            <th className="r">{col("schaeumenPct")}</th>
            <th className="r">{col("ktlEur")}</th>
            <th className="r">{col("pulverEur")}</th>
            <th className="r">{col("schaeumenEur")}</th>
          </tr>
        </thead>
        <tbody>
          {table.fixed.map((c) => {
            const name = t(`settings.costs.${c.id}`);
            return (
              <tr key={c.id}>
                <td>
                  {name} <em className="cellref">{c.row}</em>
                </td>
                <td className="r">
                  <NumCell value={c.amount} onChange={(v) => setCost(c.id, "amount", v)} label={t("settings.amountOf", { name })} width={110} />
                </td>
                <td className="r">
                  <NumCell value={c.ktl} percent onChange={(v) => setCost(c.id, "ktl", v)} label={t("settings.shareOf", { name, line: "KTL" })} width={70} />
                </td>
                <td className="r">
                  <NumCell
                    value={c.pulver}
                    percent
                    onChange={(v) => setCost(c.id, "pulver", v)}
                    label={t("settings.shareOf", { name, line: t("process.pulver") })}
                    width={70}
                  />
                </td>
                <td className="r muted">{pct(c.schaeumen, 0)}</td>
                <td className="r">{num(c.ktlEur, 2)}</td>
                <td className="r">{num(c.pulverEur, 2)}</td>
                <td className="r">{num(c.schaeumenEur, 2)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>{row("sum")}</td>
            <td className="r">{num(table.totals.all, 2)}</td>
            <td colSpan={3} />
            <td className="r">{num(table.totals.ktl, 2)}</td>
            <td className="r">{num(table.totals.pulver, 2)}</td>
            <td className="r">{num(table.totals.schaeumen, 2)}</td>
          </tr>
          <tr>
            <td>{row("hours")}</td>
            <td colSpan={4} />
            <td className="r">{num(table.hours.ktl)}</td>
            <td className="r">{num(table.hours.pulver)}</td>
            <td className="r">{num(table.hours.schaeumen)}</td>
          </tr>
          <tr className="is-key">
            <td>{row("rate")}</td>
            <td colSpan={4} />
            <td className="r">{eur(table.rate.ktl)}</td>
            <td className="r">{eur(table.rate.pulver)}</td>
            <td className="r">{eur(table.rate.schaeumen)}</td>
          </tr>
          {/* rows 25-27 (per carrier / metre of chain) are their own block,
              set apart from the machine-hour rate above */}
          <tr className="set-gap" aria-hidden="true">
            <td colSpan={8} />
          </tr>
          <tr className="is-per-unit">
            <td>{row("ratePerUnit")}</td>
            <td colSpan={4} />
            <td className="r">{eur(table.ratePerUnit.ktl)}</td>
            <td className="r">{eur(table.ratePerUnit.pulver)}</td>
            <td />
          </tr>
          <tr className="is-per-unit">
            <td>{row("variablePerUnit")}</td>
            <td colSpan={4} />
            <td className="r">{eur(table.variablePerUnit.ktl)}</td>
            <td className="r">{eur(table.variablePerUnit.pulver)}</td>
            <td />
          </tr>
          <tr className="is-per-unit is-last">
            <td>{row("sumPerUnit")}</td>
            <td colSpan={4} />
            <td className="r">{eur(table.sumPerUnit.ktl)}</td>
            <td className="r">{eur(table.sumPerUnit.pulver)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <div className="set-side">
        <h4>{t("settings.hours")}</h4>
        <div className="set-kv">
          {hourFields.slice(0, 3).map(([labelKey, percent, valueKey]) => (
            <React.Fragment key={labelKey}>
              <span>{t(`settings.${labelKey}`)}</span>
              <NumCell value={s[valueKey ?? labelKey]} percent={percent} onChange={(v) => onChange({ [valueKey ?? labelKey]: v })} label={t(`settings.${labelKey}`)} />
            </React.Fragment>
          ))}
          <span>{t("settings.onePerYear")}</span>
          <strong>{num(table.onePerYear)} h</strong>
          {hourFields.slice(3).map(([labelKey, percent, valueKey]) => (
            <React.Fragment key={labelKey}>
              <span>{t(`settings.${labelKey}`)}</span>
              <NumCell value={s[valueKey ?? labelKey]} percent={percent} onChange={(v) => onChange({ [valueKey ?? labelKey]: v })} label={t(`settings.${labelKey}`)} />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KtlCostTable;
