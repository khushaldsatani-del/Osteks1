import React, { useEffect, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { formatIndianDigits } from "../Calculation/format";
import "./offerDetails.css";

// "05072026" -> "05-07-2026" as the user types, digits only, dd-mm-yyyy.
const formatDateDigits = (raw) => {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  let out = dd;
  if (mm) out += `-${mm}`;
  if (yyyy) out += `-${yyyy}`;
  return out;
};

// These four fields mirror a value the user already entered elsewhere
// (Extracted Details / Pricing Analysis) — they auto-fill here and stay
// read-only so the two sections can never drift apart.
const FIELDS = [
  { key: "teilebezeichnung", label: "Teilebezeichnung:", placeholder: "Enter Teilebezeichnung" },
  { key: "zeichnungsnummer", label: "Zeichnungsnummer:", placeholder: "Enter Zeichnungsnummer" },
  { key: "lackiervorschrift", label: "Lackiervorschrift:", placeholder: "Enter Lackiervorschrift" },
  { key: "schichtdicke", label: "Schichtdicke:", placeholder: "Enter Schichtdicke", synced: true },
  {
    key: "jahresmenge",
    label: "Jahresmenge:",
    placeholder: "Enter Jahresmenge",
    synced: true,
    format: "indian",
  },
  {
    key: "preisBeschichtung",
    label: "Preis Beschichtung:",
    placeholder: "Enter Preis Beschichtung",
    synced: true,
    unit: "€",
  },
  {
    key: "preisMaskierung",
    label: "Preis Maskierung:",
    placeholder: "Enter Preis Maskierung",
    synced: true,
    unit: "€",
  },
  { key: "preisVerpackung", label: "Preis Verpackung:", placeholder: "Enter Preis Verpackung", unit: "€" },
  { key: "preisGesamt", label: "Preis Gesamt:", placeholder: "Enter Preis Gesamt", unit: "€" },
  {
    key: "preisKorrosionsschutztests",
    label: "Preis Korrosionsschutztests:",
    placeholder: "Enter Preis Korrosionsschutztests",
    unit: "€",
  },
  { key: "gestellbaukosten", label: "Gestellbaukosten:", placeholder: "Enter Gestellbaukosten", unit: "€" },
  {
    key: "angebotsgueltigkeit",
    label: "Angebotsgültigkeit:",
    placeholder: "DD-MM-YYYY",
    dateFormat: true,
  },
];

const initialState = FIELDS.filter((field) => !field.synced).reduce((acc, { key }) => {
  acc[key] = "";
  return acc;
}, { pruefungen: "", notes: "" });

const OfferDetails = ({ syncedFields = {}, extractedFields = {}, onOfferDetailsChange }) => {
  const [values, setValues] = useState(initialState);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = 3;

  // Teilebezeichnung / Zeichnungsnummer / Lackiervorschrift auto-fill from
  // the AI drawing extraction (Part Name / Part Number / Surface Treatment)
  // — unlike the synced fields above, there's no other editable field these
  // mirror, so they stay normal editable inputs: extraction just supplies
  // the starting value, typing over it afterward still works.
  useEffect(() => {
    if (Object.keys(extractedFields).length === 0) return;
    setValues((prev) => ({ ...prev, ...extractedFields }));
  }, [extractedFields]);

  // Feeds Document Preview's pricing/details block — same fields, same
  // order as FIELDS below, but only the ones that actually have a value:
  // per explicit request, a partially-filled form shows partial rows in
  // the document, not placeholder rows for the rest. Notes is a scratch
  // field for internal reference only and is deliberately excluded;
  // Prüfungen isn't part of FIELDS (it's a separate textarea below) so
  // it's appended by hand, in the position the user asked for.
  useEffect(() => {
    const rows = [];
    FIELDS.forEach(({ key, label, synced, format, dateFormat, unit }) => {
      const rawValue = synced ? syncedFields[key] ?? "" : values[key];
      const displayValue =
        format === "indian" ? formatIndianDigits(rawValue) : dateFormat ? formatDateDigits(rawValue) : rawValue;
      if (!displayValue) return;
      rows.push([label, unit ? `${displayValue} ${unit}` : displayValue]);
    });
    if (values.pruefungen) rows.push(["Prüfungen:", values.pruefungen]);
    onOfferDetailsChange?.(rows);
  }, [values, syncedFields, onOfferDetailsChange]);

  const set = (field) => (event) => {
    const value = event.target.value;
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNext = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="offer-card">
      <div className="offer-card-header">
        <span className="offer-card-icon">
          <FileText size={16} />
        </span>
        <h3 className="offer-card-title">Offer details</h3>
      </div>

      <div className="offer-form-grid">
        {FIELDS.map(({ key, label, placeholder, synced, unit, format, dateFormat }) => {
          const rawValue = synced ? syncedFields[key] ?? "" : values[key];
          const displayValue =
            format === "indian"
              ? formatIndianDigits(rawValue)
              : dateFormat
              ? formatDateDigits(rawValue)
              : rawValue;

          const handleDateChange = (event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
            setValues((prev) => ({ ...prev, [key]: digits }));
          };

          const input = (
            <input
              id={key}
              type="text"
              inputMode={dateFormat ? "numeric" : undefined}
              placeholder={placeholder}
              value={displayValue}
              readOnly={synced}
              className={synced ? "offer-readonly" : undefined}
              onChange={synced ? undefined : dateFormat ? handleDateChange : set(key)}
            />
          );

          return (
            <div className="offer-field" key={key}>
              <label htmlFor={key}>{label}</label>
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
          <label htmlFor="pruefungen">Prüfungen:</label>
          <textarea
            id="pruefungen"
            className="offer-notes"
            placeholder="Enter Prüfungen"
            value={values.pruefungen}
            onChange={set("pruefungen")}
          />
        </div>

        <div className="offer-field">
          <label htmlFor="offerNotes">Notes..</label>
          <textarea
            id="offerNotes"
            className="offer-notes"
            placeholder="Enter Notes"
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
            disabled={currentPage === 1}
          >
            ‹
          </button>

          {[1, 2, 3].map((page) => (
            <button
              type="button"
              key={page}
              className={`offer-pagination-number ${
                currentPage === page ? "active" : ""
              }`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            className="offer-pagination-arrow"
            onClick={handleNext}
            disabled={currentPage === totalPages}
          >
            ›
          </button>
        </div>

        <button type="button" className="offer-btn">
          <UploadCloud size={15} />
          Upload another doc
        </button>
      </div>
    </div>
  );
};

export default OfferDetails;
