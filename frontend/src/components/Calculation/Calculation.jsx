import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import FirmaInformation from "./Left/FirmaInformation";
import ExtractedDetails from "./Left/ExtractedDetails";
import RevenueMetrics from "./Right/RevenueMetrics";
import PricingAnalysis from "./Right/PricingAnalysis";
import ForInformation from "./Right/ForInformation";

import { AUTO_SYNC_FIELDS, initialState, computeCalcResults } from "./calculationDefaults";
import "./calculation.css";

// Multiple images (one per document/slot) each need their own independent
// instance of this component's state. Documents.jsx remounts Calculation
// with a fresh `key` per active slot and seeds it from `initialCalcState`
// (whatever was last reported via onCalcStateChange for that slot, or the
// hydrated data when reopening a saved record) — this is what makes
// switching slots restore exactly where that image's calculation was left,
// instead of resetting to zero.
//
// No Save button here anymore — it now lives in Offer Details, beside the
// slot-switching nav (see OfferDetails.jsx). This component still mirrors
// its full state (values/notes/touched) up to Documents.jsx on every change
// via onCalcStateChange below, so that button has always-current data to
// save for every slot, active or not — see Documents.jsx's
// handleCalculationSave.
const Calculation = ({
  onSyncOfferFields,
  firmaValues,
  onFirmaChange,
  initialCalcState,
  onCalcStateChange,
  extractedCalcValues,
}) => {
  const [values, setValues] = useState(() => initialCalcState?.values ?? initialState);
  const [notes, setNotes] = useState(() => initialCalcState?.notes ?? "");

  // Tracks whether the user has manually typed an Angebotspreis.
  // Until they do, it auto-follows the calculated price (rounded to 2dp),
  // exactly like the source Excel sheet where it starts equal to B39.
  // Seeded from initialCalcState so a slot switch (which remounts this
  // component) doesn't forget a manual override was in effect.
  const offerPriceTouched = useRef(initialCalcState?.touched?.offerPrice ?? false);

  // Same idea for the Surface Area fields: they auto-follow the value
  // derived from weight/thickness/density until the user edits either
  // field directly, at which point their typed value takes over.
  const surfaceAreaTouched = useRef(initialCalcState?.touched?.surfaceArea ?? false);

  // Same idea again, generalized, for every Pricing Analysis field in
  // AUTO_SYNC_FIELDS — each stops following its calculated value the
  // moment the user types into it directly.
  const autoSyncTouched = useRef(new Set(initialCalcState?.touched?.autoSync ?? []));

  // Weight / Coating Thickness / Spec. Gewicht auto-fill from this slot's AI
  // extraction. Usually already resolved by the time this mounts (folded
  // into initialCalcState's seed above), but a slot's tab can become active
  // — and this component mount — before its own extraction has actually
  // finished (e.g. the auto-advance through tabs during a multi-image
  // upload): in that case `extractedCalcValues` arrives later, after mount,
  // as a normal prop update, so it needs this effect to actually reach the
  // form. Only fills a field that's still at its untouched default — a
  // value the user already typed (or a value auto-filled a moment ago from
  // an earlier, still-loading state) is never overwritten.
  useEffect(() => {
    if (!extractedCalcValues) return;
    // `_surfaceAreaExplicit`/surfaceAreaMm2/surfaceAreaM2 are handled in
    // their own branch below, deliberately outside the generic per-field
    // loop: unlike every other field here, surfaceAreaMm2/M2 get
    // auto-synced away from their pristine "" default to a computed value
    // (even "0" before weight/thickness exist) by the effect further down,
    // almost immediately after mount — well before extraction data can
    // arrive. So the generic `prev[key] === initialState[key]` guard the
    // loop uses for every other field is already false for these two by
    // the time real data shows up, even though the user never touched
    // them, and the fill would be silently skipped. The correct guard for
    // these two is the same one the auto-sync effect itself uses —
    // `!surfaceAreaTouched.current` — which this also sets to true so that
    // effect stops recomputing over the explicit value on the very next
    // render (this was a real, reproduced bug: an explicit Surface Area
    // from an extraction would flash in for a moment and then immediately
    // get overwritten by a freshly recomputed weight/thickness/density
    // value).
    const { _surfaceAreaExplicit, surfaceAreaMm2: extractedMm2, surfaceAreaM2: extractedM2, ...extractedFields } =
      extractedCalcValues;
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [key, val] of Object.entries(extractedFields)) {
        if (prev[key] === initialState[key]) {
          next[key] = val;
          changed = true;
        }
      }
      if (_surfaceAreaExplicit && !surfaceAreaTouched.current && extractedMm2 !== undefined) {
        next.surfaceAreaMm2 = extractedMm2;
        next.surfaceAreaM2 = extractedM2;
        surfaceAreaTouched.current = true;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [extractedCalcValues]);

  // While the user is actively typing, an empty field just stays empty —
  // otherwise every backspace-to-empty would instantly snap back to the
  // calculated value and the field could never actually be cleared. The
  // fallback only happens in handleBlur, once the user leaves the field.
  const handleChange = (field, value) => {
    if (field === "offerPrice") {
      offerPriceTouched.current = value !== "";
      setValues((prev) => ({ ...prev, offerPrice: value }));
      return;
    }

    const autoSyncEntry = AUTO_SYNC_FIELDS.find(([f]) => f === field);
    if (autoSyncEntry) {
      if (value === "") {
        autoSyncTouched.current.delete(field);
      } else {
        autoSyncTouched.current.add(field);
      }
      setValues((prev) => ({ ...prev, [field]: value }));
      return;
    }

    if (field === "surfaceAreaMm2" || field === "surfaceAreaM2") {
      surfaceAreaTouched.current = value !== "";

      if (value === "") {
        // Blank both — a half-blank pair (mm² empty, m² still showing a
        // stale number) would be confusing while editing.
        setValues((prev) => ({ ...prev, surfaceAreaMm2: "", surfaceAreaM2: "" }));
        return;
      }

      if (field === "surfaceAreaMm2") {
        const mm2 = Number(value);
        setValues((prev) => ({
          ...prev,
          surfaceAreaMm2: value,
          surfaceAreaM2: Number.isFinite(mm2) ? String(mm2 / 1_000_000) : prev.surfaceAreaM2,
        }));
      } else {
        const m2 = Number(value);
        setValues((prev) => ({
          ...prev,
          surfaceAreaM2: value,
          surfaceAreaMm2: Number.isFinite(m2) ? String(m2 * 1_000_000) : prev.surfaceAreaMm2,
        }));
      }
      return;
    }

    setValues((prev) => ({ ...prev, [field]: value }));
  };

  // Runs when a field loses focus. If it's still empty at that point, fall
  // back to its calculated value (or plain "0" for raw inputs that have no
  // formula of their own) — using `results`/`values` from the render
  // that's currently in scope, not a useEffect keyed on the natural value:
  // clearing an override doesn't change any upstream input, so an
  // effect-based approach would never see a dependency change and the
  // field would stay blank forever instead of falling back.
  const handleBlur = (field) => {
    if (field === "offerPrice") {
      if (values.offerPrice !== "") return;
      offerPriceTouched.current = false;
      const fallback = results.kalkulierterPreis.toFixed(2);
      setValues((prev) => ({ ...prev, offerPrice: fallback }));
      return;
    }

    const autoSyncEntry = AUTO_SYNC_FIELDS.find(([f]) => f === field);
    if (autoSyncEntry) {
      if (values[field] !== "") return;
      const [, naturalKey, decimals] = autoSyncEntry;
      autoSyncTouched.current.delete(field);
      const fallback = results[naturalKey].toFixed(decimals);
      setValues((prev) => ({ ...prev, [field]: fallback }));
      return;
    }

    if (field === "surfaceAreaMm2" || field === "surfaceAreaM2") {
      if (values.surfaceAreaMm2 !== "" && values.surfaceAreaM2 !== "") return;
      surfaceAreaTouched.current = false;
      const mm2 = String(Math.round(results.naturalSurfaceAreaMm2));
      const m2 = (results.naturalSurfaceAreaMm2 / 1_000_000).toFixed(4);
      setValues((prev) => ({ ...prev, surfaceAreaMm2: mm2, surfaceAreaM2: m2 }));
      return;
    }

    if (field === "carrierSurfaceM2" || field === "etzPercent") {
      if (values[field] !== "") return;
      setValues((prev) => ({ ...prev, [field]: "0" }));
    }
  };

  // The engine must only ever see an override for a field the user actually
  // typed into — see computeCalcResults in calculationDefaults.js (shared
  // with Documents.jsx, which needs the exact same computation to save a
  // non-active slot's results when "Save" is clicked).
  const results = useMemo(
    () =>
      computeCalcResults(values, {
        surfaceArea: surfaceAreaTouched.current,
        autoSync: Array.from(autoSyncTouched.current),
      }),
    [values]
  );

  // Auto-sync the offer price to the calculated price until the
  // user overrides it themselves.
  useEffect(() => {
    if (offerPriceTouched.current) return;
    const rounded = results.kalkulierterPreis.toFixed(2);
    setValues((prev) => (prev.offerPrice === rounded ? prev : { ...prev, offerPrice: rounded }));
  }, [results.kalkulierterPreis]);

  // Auto-sync the surface area fields to the weight/thickness/density
  // derived value until the user overrides them themselves. Displayed at
  // whole mm² (rounded, not truncated — 44161.50 shows as 44162) and 4
  // decimal places for m²; the full-precision value is still what every
  // downstream formula actually uses (see the blanking logic above).
  useEffect(() => {
    if (surfaceAreaTouched.current) return;
    const mm2 = String(Math.round(results.naturalSurfaceAreaMm2));
    const m2 = (results.naturalSurfaceAreaMm2 / 1_000_000).toFixed(4);
    setValues((prev) =>
      prev.surfaceAreaMm2 === mm2 && prev.surfaceAreaM2 === m2
        ? prev
        : { ...prev, surfaceAreaMm2: mm2, surfaceAreaM2: m2 }
    );
  }, [results.naturalSurfaceAreaMm2]);

  // Auto-sync every Pricing Analysis field to its calculated value until
  // the user overrides it themselves (see AUTO_SYNC_FIELDS above).
  useEffect(() => {
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [field, naturalKey, decimals] of AUTO_SYNC_FIELDS) {
        if (autoSyncTouched.current.has(field)) continue;
        const formatted = results[naturalKey].toFixed(decimals);
        if (next[field] !== formatted) {
          next[field] = formatted;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [
    results.naturalPartsPerCarrier,
    results.naturalBasePricePerPart,
    results.naturalPicklingCost,
    results.naturalMaskingCost,
    results.naturalCastingSurcharge,
    results.naturalTotalPrice,
    results.naturalKalkulierterPreis,
    results.naturalWeightPerCarrierKg,
  ]);

  // Keeps Offer Details' mirrored fields (Schichtdicke, Jahresmenge, Preis
  // Beschichtung, Preis Maskierung) equal to their source fields here —
  // Schichtdicke in µm, Quantity, Kalkulierter Preis, and Maskierung pro
  // Teil. Preis Beschichtung explicitly mirrors Kalkulierter Preis (the
  // final marked-up price after Beizen/Maskierung/Gußzuschlag/ETZ), not
  // Preis pro Teil (the base coating cost before those) — deliberate,
  // per explicit request; see git history if this ever needs revisiting.
  // useLayoutEffect, not useEffect — this is the first hop of the chain
  // that ends at Document Preview (Calculation -> Documents ->
  // OfferDetails -> Documents -> DocPreview); firing synchronously before
  // paint instead of after lets that whole chain settle within the same
  // commit far more often, instead of trailing your typing by a visible
  // beat. Same values, same order, same everything else — only the timing
  // relative to paint changed.
  useLayoutEffect(() => {
    onSyncOfferFields?.({
      schichtdicke: values.schichtdickeUm,
      jahresmenge: values.quantity,
      preisBeschichtung: values.kalkulierterPreis,
      preisMaskierung: values.maskingCost,
    });
  }, [
    values.schichtdickeUm,
    values.quantity,
    values.kalkulierterPreis,
    values.maskingCost,
    onSyncOfferFields,
  ]);

  // Mirrors this slot's full calculation state (values/notes/touched flags)
  // up to Documents.jsx on every change, so it can be restored verbatim the
  // next time this slot becomes active (or the record is reopened later).
  useEffect(() => {
    onCalcStateChange?.({
      values,
      notes,
      touched: {
        offerPrice: offerPriceTouched.current,
        surfaceArea: surfaceAreaTouched.current,
        autoSync: Array.from(autoSyncTouched.current),
      },
    });
  }, [values, notes, onCalcStateChange]);

  return (
    <section className="calculation-section">
      {/* LEFT COLUMN — Firma Information + Extracted Details + For Information */}
      <div className="calc-column calc-column--left">
        <FirmaInformation
          values={firmaValues}
          onChange={(field, value) => onFirmaChange?.({ ...firmaValues, [field]: value })}
        />
        <ExtractedDetails values={values} onChange={handleChange} onBlur={handleBlur} />

        <ForInformation
          offerPricePerM2={results.offerPricePerM2}
          offerRevenuePerCarrier={results.offerRevenuePerCarrier}
          offerPricePerKg={results.offerPricePerKg}
        />
      </div>

      {/* RIGHT COLUMN — Revenue Metrics + Pricing Analysis */}
      <div className="calc-column calc-column--right">
        <RevenueMetrics
          revenuePerCarrier={results.revenuePerCarrier}
          revenuePerM2={results.revenuePerM2}
          annualRevenue={results.annualRevenue}
        />

        {/* PricingAnalysis is this column's `.calc-card--grow` (flex:1),
            and its own Notes textarea is flex:1 again inside that — so with
            the old Save button/nav row removed from below it, it just grows
            a bit taller to fill the space, automatically keeping this
            column's total height equal to the left column's (see the grid
            comment at the top of calculation.css). Nothing to size by hand. */}
        <PricingAnalysis
          values={values}
          onChange={handleChange}
          onBlur={handleBlur}
          notes={notes}
          onNotesChange={setNotes}
        />
      </div>
    </section>
  );
};

export default Calculation;
