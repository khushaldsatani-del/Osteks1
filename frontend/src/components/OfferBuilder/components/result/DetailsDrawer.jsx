import React, { useEffect } from "react";
import { X } from "lucide-react";
import KtlResult from "./KtlResult";
import PulverResult from "./PulverResult";
import { eur } from "../../engine/format";
import { useT } from "../../i18n/languageContext";

// "Calculation details": every line of the Excel calculation with its
// cell, opened from the price card - so the page itself stays calm but
// nothing of the sheet is hidden.
const DetailsDrawer = ({ process, part, result, settings, onClose }) => {
  const { t } = useT();

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="layer">
      <button type="button" className="layer-backdrop" aria-label={t("common.close")} tabIndex={-1} onClick={onClose} />
      <aside className="drawer drawer--narrow" role="dialog" aria-modal="true" aria-label={t("price.details")}>
        <header className="drawer-head">
          <div>
            <h2>{t("price.details")}</h2>
            <p>{part.name || t("work.newPart")}</p>
          </div>
          <div className="drawer-key">
            <span>{t("price.calculated")}</span>
            <strong>{eur(result.calculatedPrice, 4)}</strong>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </header>
        <div className="drawer-body">
          {process === "ktl" ? <KtlResult result={result} settings={settings} /> : <PulverResult result={result} settings={settings} />}
        </div>
      </aside>
    </div>
  );
};

export default DetailsDrawer;
