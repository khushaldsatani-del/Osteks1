import React from "react";
import { ChevronRight } from "lucide-react";
import { decimal, eur, num, parseNum, pct } from "../../engine/format";
import { useT } from "../../i18n/languageContext";
import { fieldList } from "./fieldLabels";
import NumberInput from "../common/NumberInput";

// The one card on the right: the calculated price (KTL: the machine-hour
// formula, F32), the offer price to type (empty = the calculated one,
// rounded, goes into the letter), the lines the user checks - the sheet's
// own price block (KTL B25-B34, Pulver B33-B40) - three key figures, and the
// way into the full Excel calculation.
const PriceCard = ({ process, part, result, onChange, onDetails }) => {
  const { t } = useT();
  const isKtl = process === "ktl";
  const price = result.calculatedPrice;
  const typed = parseNum(part.offerPrice);

  const o = result.old;
  // KTL: the sheet's block B25-B34, with the sheet's own labels.
  // [key, label, shown value, strong]
  const lines = isKtl
    ? [
        ["b25", t("price.excel.base"), eur(o?.basePrice, 4)],
        ["b26", t("price.excel.pickling"), eur(o?.pickling, 4)],
        ["b27", t("price.excel.masking"), eur(o?.maskingCost, 2)],
        ["b28", t("price.excel.casting"), eur(o?.casting, 4)],
        ["b29", t("price.excel.sum"), eur(o?.sum, 4), true],
        ["b30", t("price.excel.etz"), pct(o?.etz)],
        ["b32", t("price.excel.total"), eur(o?.price, 4), true],
        ["b34", t("price.excel.offerPrice"), part.offerPrice !== "" && typed > 0 ? eur(typed, 4) : "–"],
      ]
    : [
        // Pulver: the sheet's block B33-B40, with the sheet's own labels
        ["b33", t("price.pulverExcel.withoutMaterial"), eur(result.priceBeforeMaterial, 4)],
        ["b34", t("price.pulverExcel.material"), eur(result.materialCost, 4)],
        ["b35", t("price.pulverExcel.withMaterial"), eur(result.priceWithMaterial, 4), true],
        ["b36", t("price.pulverExcel.etz"), pct(result.etz)],
        ["b37", t("price.pulverExcel.price"), eur(result.price, 4), true],
        ["b40", t("price.pulverExcel.offerPrice"), part.offerPrice !== "" && typed > 0 ? eur(typed, 4) : "–"],
      ];
  const facts = isKtl
    ? [
        [t("work.piecesPerCarrier"), num(result.partsPerCarrier)],
        [t("work.piecesPerHour"), num(result.machine.piecesPerHour)],
        [t("work.carriersPerYear"), num(result.machine.carriersPerYear, 1)],
      ]
    : [
        [t("work.partsPerHour"), num(result.partsPerHour)],
        [t("work.runtime"), result.runtimeMinutes == null ? "–" : `${num(result.runtimeMinutes / 60, 1)} h`],
        [t("work.powderPerPart"), `${num(result.gramsPerPart, 1)} g`],
      ];

  return (
    <aside className="price-card">
      <div className="price-main">
        <span>{t("price.calculated")}</span>
        <strong>{eur(price, 4)}</strong>
        {/* why there is no price yet, or what to check - field by field */}
        {result.invalid?.length > 0 ? (
          <em className="is-error" role="alert">
            {t("price.invalid", { fields: fieldList(process, result.invalid, t) })}
          </em>
        ) : result.missing?.length > 0 ? (
          <em className="is-warn">{t("price.missing", { fields: fieldList(process, result.missing, t) })}</em>
        ) : result.warnings?.length > 0 ? (
          <em className="is-warn">{t("price.warnings", { fields: fieldList(process, result.warnings, t) })}</em>
        ) : null}
      </div>

      <label className="price-offer">
        <span>{t("result.offerPrice")}</span>
        <span className="price-offer-box">
          <NumberInput
            value={part.offerPrice}
            onChange={(next) => onChange({ offerPrice: next })}
            placeholder={price == null ? "–" : decimal(Math.round(price * 100) / 100)}
          />
          <span>€</span>
        </span>
        {/* only while the box is empty: what an empty offer price means */}
        {!(part.offerPrice !== "" && typed > 0) && <span className="price-diff">{t("result.emptyHint")}</span>}
      </label>

      <ul className="price-lines">
        {lines.map(([key, label, value, strong]) => (
          <li key={key} className={strong ? "is-strong" : ""}>
            <span>{label}</span>
            <span>{value}</span>
          </li>
        ))}
      </ul>

      <dl className="price-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <button type="button" className="details-btn" onClick={onDetails}>
        {t("price.details")}
        <ChevronRight size={16} />
      </button>
    </aside>
  );
};

export default PriceCard;
