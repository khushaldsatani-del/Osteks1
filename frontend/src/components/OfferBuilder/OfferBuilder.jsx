import React from "react";
import PageHeader from "./components/PageHeader";
import PartTabs from "./components/parts/PartTabs";
import KtlPartForm from "./components/parts/KtlPartForm";
import PulverPartForm from "./components/parts/PulverPartForm";
import PriceCard from "./components/result/PriceCard";
import DetailsDrawer from "./components/result/DetailsDrawer";
import SettingsDrawer from "./components/settings/SettingsDrawer";
import OfferDialog from "./components/offer/OfferDialog";
import { useT } from "./i18n/languageContext";
import "./offerBuilder.css";

// The KTL / Powder offer builder on Work Place: one header row (title, KTL /
// Powder, customer, settings, new, save, view offer), the parts as tabs,
// then the open part's form beside its price card. The full Excel
// calculation, the fixed values and the customer / letter texts open on
// top. The state lives in Work Place (useOfferStore there), so an uploaded
// drawing can fill a part in; the offer letter is opened by Work Place too.
const OfferBuilder = ({ store, layer, onLayer, onViewOffer, onNewOffer, onSave, saveState }) => {
  const { t, language } = useT();
  const { state, dispatch, offer, settings, results, selected, result } = store;
  const process = state.process;
  const onPart = (changes) => dispatch({ type: "part", id: selected.id, changes });
  const Form = process === "ktl" ? KtlPartForm : PulverPartForm;
  const close = () => onLayer(null);

  return (
    <section className="ob">
      <div className="page">
        <PageHeader
          process={process}
          offer={offer}
          onProcess={(p) => dispatch({ type: "process", process: p })}
          onCustomer={() => onLayer("offer")}
          onSettings={() => onLayer("settings")}
          onPreview={onViewOffer}
          onNew={() => window.confirm(t("confirm.newOffer")) && onNewOffer()}
          onSave={onSave}
          saveState={saveState}
        />

        <PartTabs
          parts={offer.parts}
          results={results}
          selectedId={selected.id}
          onSelect={(id) => dispatch({ type: "select", id })}
          onAdd={() => dispatch({ type: "addPart" })}
          onDuplicate={(id) => dispatch({ type: "duplicatePart", id, suffix: t("parts.copySuffix") })}
          onRemove={(id) => window.confirm(t("confirm.removePart")) && dispatch({ type: "removePart", id })}
        />

        <div className="workarea" key={selected.id}>
          <Form
            part={selected}
            result={result}
            settings={settings}
            offer={offer}
            onChange={onPart}
            onOffer={(changes) => dispatch({ type: "offer", changes })}
            onCustomer={(changes) => dispatch({ type: "customer", changes })}
          />
          <PriceCard process={process} part={selected} result={result} onChange={onPart} onDetails={() => onLayer("details")} />
        </div>
      </div>

      {layer === "details" && <DetailsDrawer process={process} part={selected} result={result} settings={settings} onClose={close} />}
      {layer === "settings" && (
        <SettingsDrawer
          settings={state.settings}
          process={process}
          onChange={(p, changes) => dispatch({ type: "settings", process: p, changes })}
          onReset={(p) => window.confirm(t("confirm.resetSettings")) && dispatch({ type: "resetSettings", process: p })}
          onClose={close}
        />
      )}
      {layer === "offer" && (
        <OfferDialog
          process={process}
          offer={offer}
          onOffer={(changes) => dispatch({ type: "offer", changes })}
          onCustomer={(changes) => dispatch({ type: "customer", changes })}
          onTexts={(texts) => dispatch({ type: "texts", language, texts })}
          onResetTexts={() => dispatch({ type: "resetTexts", language })}
          onClose={close}
        />
      )}
    </section>
  );
};

export default OfferBuilder;
