import React from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { eur } from "../../engine/format";
import { priceForLetter } from "../../state/useOfferStore";
import { useT } from "../../i18n/languageContext";

// The offer's parts as a row of tabs above the form (a Pulver letter often
// quotes several parts): name and the price that goes into the letter. The
// open part can be copied or removed; "+" adds one.
const PartTabs = ({ parts, results, selectedId, onSelect, onAdd, onDuplicate, onRemove }) => {
  const { t } = useT();
  const selected = parts.find((p) => p.id === selectedId) ?? parts[0];
  const selectedLabel = selected.name || t("parts.partN", { n: parts.indexOf(selected) + 1 });

  return (
    <div className="part-tabs">
      <div className="part-tabs-list" role="tablist" aria-label={t("parts.title")}>
        {parts.map((p, index) => {
          const price = priceForLetter(p, results[p.id]);
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === selected.id}
              className={`part-tab ${p.id === selected.id ? "is-active" : ""}`}
              onClick={() => onSelect(p.id)}
            >
              <span className="part-tab-name">{p.name || t("parts.partN", { n: index + 1 })}</span>
              <span className={`part-tab-price ${price == null ? "is-missing" : ""}`}>{price == null ? t("parts.missing") : eur(price, 2)}</span>
            </button>
          );
        })}
        <button type="button" className="part-tab part-tab--add" onClick={onAdd} aria-label={t("parts.add")} title={t("parts.add")}>
          <Plus size={15} />
        </button>
      </div>

      <div className="part-tabs-tools">
        <button type="button" className="icon-btn icon-btn--sm" onClick={() => onDuplicate(selected.id)} aria-label={t("parts.copyOf", { name: selectedLabel })} title={t("parts.copy")}>
          <Copy size={14} />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm icon-btn--danger"
          onClick={() => onRemove(selected.id)}
          aria-label={t("parts.deleteOf", { name: selectedLabel })}
          title={t("parts.delete")}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default PartTabs;
