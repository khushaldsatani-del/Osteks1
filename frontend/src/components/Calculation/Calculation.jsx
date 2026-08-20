import React, { useEffect, useMemo, useRef, useState } from "react";
import { Save } from "lucide-react";

import FirmaInformation from "./Left/FirmaInformation";
import ExtractedDetails from "./Left/ExtractedDetails";
import RevenueMetrics from "./Right/RevenueMetrics";
import PricingAnalysis from "./Right/PricingAnalysis";
import ForInformation from "./Right/ForInformation";

import { runFullCalculation } from "./calculationEngine";
import { parseExtractionSummary } from "./extractionParser";
import "./calculation.css";

// Pricing Analysis fields that are normally computed but can be typed over
// directly. Each auto-follows its calculated ("natural") value, at the
// given decimal precision, until the user edits it themselves.
const AUTO_SYNC_FIELDS = [
  ["partsPerCarrier", "naturalPartsPerCarrier", 0],
  ["basePricePerPart", "naturalBasePricePerPart", 4],
  ["picklingCost", "naturalPicklingCost", 4],
  ["maskingCost", "naturalMaskingCost", 2],
  ["castingSurcharge", "naturalCastingSurcharge", 2],
  ["totalPrice", "naturalTotalPrice", 4],
  ["kalkulierterPreis", "naturalKalkulierterPreis", 4],
  ["weightPerCarrierKg", "naturalWeightPerCarrierKg", 2],
];

// Everything starts at zero/unselected — nothing is calculated until the
// user actually fills in the fields a given formula depends on.
const initialState = {
  companyName: "",
  address: "",
  offerNumber: "",
  enquiryDate: "",

  weightG: "0",
  thicknessMm: "0",
  densityGcm3: "",
  schichtdickeUm: "",
  quantity: "0",
  beizenJN: "j",
  gussteilJN: "",
  gusszuschlagPercent: "30",
  maskierungStueck: "0",

  surfaceAreaMm2: "",
  surfaceAreaM2: "",

  carrierSurfaceM2: "45",
  etzPercent: "25.5",
  offerPrice: "0",

  partsPerCarrier: "",
  basePricePerPart: "",
  picklingCost: "",
  maskingCost: "",
  castingSurcharge: "",
  totalPrice: "",
  kalkulierterPreis: "",
  weightPerCarrierKg: "",
};

const Calculation = ({ onSave, onSyncOfferFields, onFirmaInfoChange, extractionSummary }) => {
  const [values, setValues] = useState(initialState);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 3;

  // Tracks whether the user has manually typed an Angebotspreis.
  // Until they do, it auto-follows the calculated price (rounded to 2dp),
  // exactly like the source Excel sheet where it starts equal to B39.
  const offerPriceTouched = useRef(false);

  // Same idea for the Surface Area fields: they auto-follow the value
  // derived from weight/thickness/density until the user edits either
  // field directly, at which point their typed value takes over.
  const surfaceAreaTouched = useRef(false);

  // Same idea again, generalized, for every Pricing Analysis field in
  // AUTO_SYNC_FIELDS — each stops following its calculated value the
  // moment the user types into it directly.
  const autoSyncTouched = useRef(new Set());

  // While the user is actively typing, an empty field just stays empty —
  // otherwise every backspace-to-empty would instantly snap back to the
  // calculated value and the field could never actually be cleared. The
  // fallback only happens in handleBlur, once the user leaves the field.
  const handleChange = (field, value) => {
    if (field === "offerPrice") {
      offerPriceTouched.current = value !== "";
      setValues((prev) => ({ ...prev, offerPrice: value }));
      setSaved(false);
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
      setSaved(false);
      return;
    }

    if (field === "surfaceAreaMm2" || field === "surfaceAreaM2") {
      surfaceAreaTouched.current = value !== "";

      if (value === "") {
        // Blank both — a half-blank pair (mm² empty, m² still showing a
        // stale number) would be confusing while editing.
        setValues((prev) => ({ ...prev, surfaceAreaMm2: "", surfaceAreaM2: "" }));
        setSaved(false);
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
      setSaved(false);
      return;
    }

    setValues((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
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
  // typed into. Auto-synced fields hold a *rounded, formatted* display
  // string (e.g. "0.3201") — feeding that back in as if it were a real
  // override would replace full-precision math with rounded math on every
  // render, and the error compounds through the rest of the formula chain.
  // So untouched auto-synced fields are blanked out here before the engine
  // ever sees them; it then recomputes them naturally at full precision.
  const results = useMemo(() => {
    const engineInputs = { ...values };
    if (!surfaceAreaTouched.current) {
      engineInputs.surfaceAreaMm2 = "";
      engineInputs.surfaceAreaM2 = "";
    }
    for (const [field] of AUTO_SYNC_FIELDS) {
      if (!autoSyncTouched.current.has(field)) {
        engineInputs[field] = "";
      }
    }
    return runFullCalculation(engineInputs);
  }, [values]);

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

  // Auto-fills Weight / Coating Thickness / Spec. Gewicht from a fresh
  // drawing extraction — each new successful extraction overwrites these
  // three fields, same as the user retyping them by hand.
  useEffect(() => {
    if (!extractionSummary) return;
    const parsed = parseExtractionSummary(extractionSummary);
    if (Object.keys(parsed).length === 0) return;
    setValues((prev) => ({ ...prev, ...parsed }));
  }, [extractionSummary]);

  const handleSave = () => {
    setSaved(true);
    onSave?.({ ...values, notes, ...results });
    window.setTimeout(() => setSaved(false), 2000);
  };

  // Keeps Offer Details' mirrored fields (Schichtdicke, Jahresmenge, Preis
  // Beschichtung, Preis Maskierung) equal to their source fields here —
  // Schichtdicke in µm, Quantity, Preis pro Teil, and Maskierung pro Teil.
  useEffect(() => {
    onSyncOfferFields?.({
      schichtdicke: values.schichtdickeUm,
      jahresmenge: values.quantity,
      preisBeschichtung: values.basePricePerPart,
      preisMaskierung: values.maskingCost,
    });
  }, [
    values.schichtdickeUm,
    values.quantity,
    values.basePricePerPart,
    values.maskingCost,
    onSyncOfferFields,
  ]);

  // Feeds Document Preview's Projekt / recipient address / Angebot Nr. —
  // separate from the sync above since it's Document Preview's concern, not
  // Offer Details'.
  useEffect(() => {
    onFirmaInfoChange?.({
      companyName: values.companyName,
      address: values.address,
      offerNumber: values.offerNumber,
    });
  }, [values.companyName, values.address, values.offerNumber, onFirmaInfoChange]);

  return (
    <section className="calculation-section">
      {/* LEFT COLUMN — Firma Information + Extracted Details + For Information */}
      <div className="calc-column calc-column--left">
        <FirmaInformation values={values} onChange={handleChange} />
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

        <PricingAnalysis
          values={values}
          onChange={handleChange}
          onBlur={handleBlur}
          notes={notes}
          onNotesChange={setNotes}
        />

        <div className="calc-actions">
          <div className="calc-pagination">
            <button
              type="button"
              className="calc-pagination-arrow"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              ‹
            </button>

            {[1, 2, 3].map((page) => (
              <button
                type="button"
                key={page}
                className={`calc-pagination-number ${currentPage === page ? "active" : ""}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              className="calc-pagination-arrow"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
          </div>

          <button type="button" className="calc-btn calc-btn--solid" onClick={handleSave}>
            <Save size={15} />
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
};

export default Calculation;
