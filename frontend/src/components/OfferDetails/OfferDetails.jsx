import React, { useEffect, useLayoutEffect, useState } from "react";
import { FileText, Save } from "lucide-react";
import { formatGermanDigits, formatGermanLive, cleanNumericInput } from "../Calculation/format";
import {
  FIELDS,
  initialOfferState as initialState,
  formatDateDigits,
  computePreisGesamt,
  buildOfferDetailsRows,
} from "./offerDetailsRows";
import { useTranslation } from "../../i18n/LanguageContext";
import "./offerDetails.css";

// Default "Angebotsgültigkeit" (offer validity) — today, as raw DDMMYYYY
// digits (formatDateDigits's storage format), so it's just a normal
// pre-filled value the user can still freely edit like any other date here.
// Document Preview's "Preisgültigkeit" is derived FROM this field (today's
// default, or whatever date the user types here instead) plus 3 months —
// see docPreviewContent.js's getPriceValidityDateLine — so it's never
// computed independently; this only ever needs to be "today".
const defaultAngebotsgueltigkeitDigits = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}${mm}${d.getFullYear()}`;
};

// Documents.jsx remounts this component with a fresh `key` per active image
// slot and seeds it via `initialValues` (whatever was last reported through
// onValuesChange for that slot, or hydrated data when reopening a saved
// record) — same pattern as Calculation.jsx, so switching slots restores
// exactly what was there before instead of resetting to blank.
const OfferDetails = ({
  syncedFields = {},
  extractedFields = {},
  onOfferDetailsChange,
  initialValues,
  onValuesChange,
  activeSlot,
  slotCount,
  onSlotChange,
  onSaveCalculation,
}) => {
  const { t } = useTranslation();
  // Local, per-slot-mount only (this component remounts on slot switch,
  // same as Calculation.jsx used to when it owned this button) — just
  // drives the "Save" -> "Saved" label swap for a couple seconds, not
  // persisted state.
  const [saved, setSaved] = useState(false);

  // Same "raw while typing, German-formatted otherwise" pattern as
  // ExtractedDetails.jsx/PricingAnalysis.jsx — only matters for the numeric
  // fields the user actually types into here (Verpackung, Korrosionsschutz-
  // tests, Gestellbaukosten); the synced/computed ones are read-only so
  // there's no typing to protect.
  const [focusedField, setFocusedField] = useState(null);

  const handleSaveClick = () => {
    setSaved(true);
    onSaveCalculation?.();
    window.setTimeout(() => setSaved(false), 2000);
  };

  // Teilebezeichnung / Zeichnungsnummer / Lackiervorschrift auto-fill from
  // the AI drawing extraction (Part Name / Part Number / Surface Treatment)
  // — unlike the synced fields above, there's no other editable field these
  // mirror, so they stay normal editable inputs: extraction just supplies
  // the starting value, typing over it afterward still works. Seeded once
  // at mount (extractedFields first, then initialValues on top so a
  // previously-typed edit for this slot always wins) for the common case
  // where extraction already finished by the time this mounts.
  // Angebotsgültigkeit gets its own "today + 3 months" default layered on
  // top of that, but ONLY when nothing already set it (a fresh slot, not a
  // reopened/previously-saved one) — still a completely normal, freely
  // editable field from there on, this just picks its starting value.
  const [values, setValues] = useState(() => {
    const seeded = { ...initialState, ...extractedFields, ...initialValues };
    if (!seeded.angebotsgueltigkeit) seeded.angebotsgueltigkeit = defaultAngebotsgueltigkeitDigits();
    return seeded;
  });

  // Preis Gesamt = Preis Beschichtung + Preis Maskierung + Preis Verpackung —
  // but ONLY once all three actually have a value; per explicit request, two
  // out of three isn't enough and must NOT show a partial sum, it stays
  // empty until Verpackung (typically the last of the three to get filled
  // in) is entered too. Recomputed live as any of the three change — the
  // first two come from Calculation via syncedFields, the third is typed
  // right here. Rounded to 2 decimals as a normal final EUR amount (the
  // per-part inputs it's built from carry more precision — 4dp for
  // Beschichtung — for their own unit-economics purposes, but a customer-
  // facing total reads as plain cents).
  useEffect(() => {
    const formatted = computePreisGesamt(syncedFields, values);
    setValues((prev) => (prev.preisGesamt === formatted ? prev : { ...prev, preisGesamt: formatted }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncedFields.preisBeschichtung, syncedFields.preisMaskierung, values.preisVerpackung]);

  // Safety net for the less common case: this slot's tab can become active
  // — and this component mount — before its own extraction has actually
  // finished (e.g. the auto-advance through tabs during a multi-image
  // upload). extractedFields then arrives later, as a normal prop update,
  // and needs this effect to actually reach the form. Only fills a field
  // that's still genuinely empty, so a value the user already typed is
  // never overwritten.
  useEffect(() => {
    if (Object.keys(extractedFields).length === 0) return;
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [key, val] of Object.entries(extractedFields)) {
        if (!prev[key]) {
          next[key] = val;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [extractedFields]);

  // Feeds Document Preview's pricing/details block, via the same
  // buildOfferDetailsRows() Documents.jsx also calls for every OTHER slot
  // (see offerDetailsRows.js's own header comment for why that matters) —
  // one shared function, so this slot's live numbers and every other
  // slot's on-demand-recomputed ones can never compute differently.
  // useLayoutEffect, not useEffect — the last hop before Document Preview
  // actually sees new data (Documents.jsx -> DocPreview.jsx is a plain
  // prop, no effect of its own in between), so firing this synchronously
  // before paint is what actually lets the whole reporting chain from
  // Calculation.jsx land within the same commit instead of a visible beat
  // later. Same computation, same rows, same order — only the timing
  // relative to paint changed.
  useLayoutEffect(() => {
    onOfferDetailsChange?.(buildOfferDetailsRows(values, syncedFields));
  }, [values, syncedFields, onOfferDetailsChange]);

  // Mirrors this slot's own editable fields up to Documents.jsx on every
  // change, so they can be restored the next time this slot becomes active
  // or the record is reopened later — same pattern as Calculation.jsx.
  useEffect(() => {
    onValuesChange?.(values);
  }, [values, onValuesChange]);

  const set = (field) => (event) => {
    const value = event.target.value;
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handlePrevious = () => {
    onSlotChange?.(Math.max(activeSlot - 1, 1));
  };

  const handleNext = () => {
    onSlotChange?.(Math.min(activeSlot + 1, slotCount));
  };

  return (
    <div className="offer-card">
      <div className="offer-card-header">
        <span className="offer-card-icon">
          <FileText size={16} />
        </span>
        <h3 className="offer-card-title">{t("offerDetails.title")}</h3>
      </div>

      <div className="offer-form-grid">
        {FIELDS.map(({ key, synced, unit, format, dateFormat, numeric, computed }) => {
          const readOnly = synced || computed;
          const rawValue = synced ? syncedFields[key] ?? "" : values[key];
          const displayValue =
            format === "german"
              ? formatGermanDigits(rawValue)
              : dateFormat
              ? formatDateDigits(rawValue)
              : numeric && focusedField !== key
              ? formatGermanLive(rawValue)
              : rawValue;

          const handleDateChange = (event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
            setValues((prev) => ({ ...prev, [key]: digits }));
          };

          const handleNumericChange = (event) => {
            setValues((prev) => ({ ...prev, [key]: cleanNumericInput(event.target.value) }));
          };

          // "DD-MM-YYYY" is a format hint, not language content — same in
          // both languages, so it's the one placeholder not looked up
          // through the dictionary.
          const placeholder = dateFormat
            ? "DD-MM-YYYY"
            : t(`offerDetails.enter${key[0].toUpperCase()}${key.slice(1)}`);

          const input = (
            <input
              id={key}
              type="text"
              inputMode={dateFormat ? "numeric" : numeric ? "decimal" : undefined}
              placeholder={placeholder}
              value={displayValue}
              readOnly={readOnly}
              className={readOnly ? "offer-readonly" : undefined}
              onFocus={!readOnly && numeric ? () => setFocusedField(key) : undefined}
              onBlur={!readOnly && numeric ? () => setFocusedField(null) : undefined}
              onChange={readOnly ? undefined : dateFormat ? handleDateChange : numeric ? handleNumericChange : set(key)}
            />
          );

          return (
            <div className="offer-field" key={key}>
              <label htmlFor={key}>{t(`offerDetails.${key}`)}</label>
              {unit ? (
                <div className="offer-input-unit">
                  {input}
                  <span>{unit}</span>
                </div>
              ) : (
                input
              )}
            </div>
          );
        })}
      </div>

      <div className="offer-textarea-grid">
        <div className="offer-field">
          <label htmlFor="pruefungen">{t("offerDetails.pruefungen")}</label>
          <textarea
            id="pruefungen"
            className="offer-notes"
            placeholder={t("offerDetails.enterPruefungen")}
            value={values.pruefungen}
            onChange={set("pruefungen")}
          />
        </div>

        <div className="offer-field">
          <label htmlFor="offerNotes">{t("offerDetails.notes")}</label>
          <textarea
            id="offerNotes"
            className="offer-notes"
            placeholder={t("offerDetails.enterNotes")}
            value={values.notes}
            onChange={set("notes")}
          />
        </div>
      </div>

      <div className="offer-footer">
        <div className="offer-pagination">
          <button
            type="button"
            className="offer-pagination-arrow"
            onClick={handlePrevious}
            disabled={activeSlot === 1}
          >
            ‹
          </button>

          {Array.from({ length: slotCount }, (_, i) => i + 1).map((page) => (
            <button
              type="button"
              key={page}
              className={`offer-pagination-number ${
                activeSlot === page ? "active" : ""
              }`}
              onClick={() => onSlotChange?.(page)}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            className="offer-pagination-arrow"
            onClick={handleNext}
            disabled={activeSlot === slotCount}
          >
            ›
          </button>
        </div>

        {/* Moved here from Calculation.jsx — one Save action for the whole
            offer (every image slot, not just this one; see Documents.jsx's
            handleCalculationSave), now sitting right beside the same nav
            that switches between those slots. */}
        <button type="button" className="offer-save-btn" onClick={handleSaveClick}>
          <Save size={15} />
          {saved ? t("calculation.saved") : t("calculation.save")}
        </button>
      </div>
    </div>
  );
};

export default OfferDetails;
