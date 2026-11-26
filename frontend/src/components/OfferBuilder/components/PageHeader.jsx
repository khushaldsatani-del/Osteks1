import React from "react";
import { Building2, Check, Eye, Flame, Layers, LoaderCircle, Plus, Save, SlidersHorizontal } from "lucide-react";
import Segmented from "./common/Segmented";
import { useT } from "../i18n/languageContext";

// The builder's one header row: title on the left, then the KTL / Powder
// switch, the customer, two quiet actions, Save, and the one strong button
// (the offer) last. Save writes the offer to the database, so All Documents
// lists it and "Open in Workspace" brings it back.
const PageHeader = ({ process, offer, onProcess, onCustomer, onSettings, onPreview, onNew, onSave, saveState = "idle" }) => {
  const { t } = useT();
  const SaveIcon = saveState === "saving" ? LoaderCircle : saveState === "saved" ? Check : Save;

  return (
    <header className="page-head">
      <div className="page-title">
        <h1>{t("app.title")}</h1>
        <p>{t("app.subtitle")}</p>
      </div>

      <Segmented
        size="md"
        label={t("process.label")}
        value={process}
        onChange={onProcess}
        options={[
          { value: "ktl", label: t("process.ktl"), icon: Layers },
          { value: "pulver", label: t("process.pulver"), icon: Flame },
        ]}
      />

      <div className="page-actions">
        <button type="button" className="customer-btn" onClick={onCustomer}>
          <Building2 size={15} />
          <span>{offer.customer.company || t("top.chooseCustomer")}</span>
          {offer.offerNo && <em>{offer.offerNo}</em>}
        </button>
        <button type="button" className="icon-btn" onClick={onSettings} aria-label={t("top.settings")} title={t("top.settings")}>
          <SlidersHorizontal size={17} />
        </button>
        <button type="button" className="icon-btn" onClick={onNew} aria-label={t("top.newTitle")} title={t("top.newTitle")}>
          <Plus size={18} />
        </button>
        <button
          type="button"
          className={`btn save-btn ${saveState === "saved" ? "is-saved" : ""} ${saveState === "error" ? "is-error" : ""}`}
          onClick={onSave}
          disabled={saveState === "saving"}
          title={saveState === "error" ? t("top.saveError") : undefined}
        >
          <SaveIcon size={15} className={saveState === "saving" ? "spin" : undefined} />
          {t(`top.save_${saveState}`)}
        </button>
        <button type="button" className="btn btn--primary" onClick={onPreview}>
          <Eye size={15} />
          {t("top.preview")}
        </button>
      </div>
    </header>
  );
};

export default PageHeader;
