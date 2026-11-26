import React, { useEffect } from "react";
import { RotateCcw, X } from "lucide-react";
import { useT } from "../../i18n/languageContext";
import { addressOf, letterTexts } from "../../letters/offerLetter";

// "Customer & offer": everything the letter needs besides the parts - the
// recipient, project and number, the dates, and the letter's texts
// (specification lines, notes, terms). The texts start as the standard
// wording of the chosen language; an edit is kept for this offer and this
// language only, and can be undone.
const OfferDialog = ({ process, offer, onOffer, onCustomer, onTexts, onResetTexts, onClose }) => {
  const { t, language } = useT();

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const c = offer.customer;
  const address = addressOf(c);
  const texts = letterTexts(offer, process, language, t);
  const edited = !!offer.texts?.[language];
  const setTexts = (changes) => onTexts({ ...texts, ...changes });
  const setRow = (listKey, index, changes) => setTexts({ [listKey]: texts[listKey].map((row, i) => (i === index ? { ...row, ...changes } : row)) });

  const text = (label, value, onChange, props = {}) => (
    <label className="fld">
      <span className="fld-label">{label}</span>
      <span className="fld-box">
        <input value={value} onChange={(event) => onChange(event.target.value)} {...props} />
      </span>
    </label>
  );

  return (
    <div className="layer layer--center">
      <button type="button" className="layer-backdrop" aria-label={t("common.close")} tabIndex={-1} onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label={t("offer.title")}>
        <header className="drawer-head">
          <div>
            <h2>{t("offer.title")}</h2>
            <p>{t(process === "ktl" ? "offer.subtitleKtl" : "offer.subtitlePulver")}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </header>

        <div className="dialog-body">
          <section className="dialog-col">
            <h4>{t("offer.recipient")}</h4>
            {text(t("offer.company"), c.company, (v) => onCustomer({ company: v }))}
            {text(t("offer.person"), c.person, (v) => onCustomer({ person: v }), { placeholder: t("offer.personPlaceholder") })}
            <label className="fld">
              <span className="fld-label">{t("offer.address")}</span>
              <span className="fld-box fld-box--area">
                <textarea
                  rows={Math.max(3, address.split("\n").length)}
                  value={address}
                  onChange={(event) => onCustomer({ address: event.target.value })}
                  placeholder={t("offer.addressPlaceholder")}
                />
              </span>
            </label>
            <h4>{t("offer.offerSection")}</h4>
            <div className="fields fields--2">
              {text(t("offer.project"), offer.project, (v) => onOffer({ project: v }))}
              {text(t("offer.offerNo"), offer.offerNo, (v) => onOffer({ offerNo: v }), { placeholder: "32484-00014" })}
              {text(t("offer.requestDate"), offer.requestDate, (v) => onOffer({ requestDate: v }), { type: "date" })}
              {text(t("offer.offerDate"), offer.offerDate, (v) => onOffer({ offerDate: v }), { type: "date" })}
              {text(t("offer.calculatedBy"), offer.calculatedBy, (v) => onOffer({ calculatedBy: v }))}
            </div>
          </section>

          <section className="dialog-col dialog-col--wide">
            <div className="dialog-texts-head">
              <span>{t("offer.textsNote", { language: t("offer.languageName") })}</span>
              {edited && (
                <button type="button" className="btn btn--sm btn--ghost" onClick={onResetTexts}>
                  <RotateCcw size={13} />
                  {t("offer.resetTexts")}
                </button>
              )}
            </div>
            <h4>{t("offer.spec")}</h4>
            {texts.spec.map((row, i) => (
              <div key={i} className="spec-row">
                <input className="spec-label" value={row.label} onChange={(event) => setRow("spec", i, { label: event.target.value })} aria-label={t("offer.label")} />
                <textarea rows={row.text.length > 90 ? 3 : 1} value={row.text} onChange={(event) => setRow("spec", i, { text: event.target.value })} aria-label={row.label} />
              </div>
            ))}
            <h4>{t("offer.notes")}</h4>
            {texts.paragraphs.map((p, i) => (
              <textarea
                key={i}
                rows={2}
                value={p}
                onChange={(event) => setTexts({ paragraphs: texts.paragraphs.map((x, j) => (j === i ? event.target.value : x)) })}
                aria-label={t("offer.noteN", { n: i + 1 })}
              />
            ))}
            <h4>{t("offer.terms")}</h4>
            {texts.terms.map((row, i) => (
              <div key={i} className="spec-row">
                <input className="spec-label" value={row.label} onChange={(event) => setRow("terms", i, { label: event.target.value })} aria-label={t("offer.label")} />
                <input value={row.text} onChange={(event) => setRow("terms", i, { text: event.target.value })} aria-label={row.label} />
              </div>
            ))}
          </section>
        </div>

        <footer className="dialog-foot">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {t("common.done")}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default OfferDialog;
