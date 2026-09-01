// Pulled out of OfferDetails.jsx so this exact row-computation can run for
// ANY image slot, not just whichever one currently has a live OfferDetails
// instance mounted (Documents.jsx only ever mounts one — the active slot;
// see its own comment on `activeSlot`). That mattered in practice for a
// multi-part drawing: Document Preview shows every slot's pricing block at
// once, but a slot you're not currently looking at has no component running
// in the background to keep its numbers fresh — its row data used to just
// freeze at whatever it last computed to, which could be an early/incomplete
// snapshot from before that tab's own calculation had settled. Documents.jsx
// now calls buildOfferDetailsRows() itself, on every render, for every slot
// that ISN'T the active one, straight from that slot's own stored
// calcState/offerValues — so Document Preview is always accurate for every
// part, not just the one you happen to be looking at.
import { formatGermanDigits, formatGermanLive } from "../Calculation/format";

// "05072026" -> "05-07-2026" as the user types, digits only, dd-mm-yyyy.
export const formatDateDigits = (raw) => {
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
// (Extracted Details / Pricing Analysis) — auto-filled, read-only.
// `preisGesamt` is similar but computed (Beschichtung + Maskierung +
// Verpackung — see computePreisGesamt below) rather than mirrored, so it's
// `computed`, not `synced`: same read-only treatment, but its source value
// lives in `values` like a normal field, not in `syncedFields`.
// Each `key` here doubles as its translation key under offerDetails.* (both
// the label and its "Enter …" placeholder), so the label a saved row shows
// in Document Preview can be re-translated from the key at render time
// instead of a label string frozen in whatever language was active when it
// was saved (see DocPreview.jsx/buildDocx.js).
export const FIELDS = [
  { key: "teilebezeichnung" },
  { key: "zeichnungsnummer" },
  { key: "lackiervorschrift" },
  { key: "schichtdicke", synced: true },
  { key: "jahresmenge", synced: true, format: "german" },
  { key: "preisBeschichtung", synced: true, unit: "€", numeric: true },
  { key: "preisMaskierung", synced: true, unit: "€", numeric: true },
  { key: "preisVerpackung", unit: "€", numeric: true },
  { key: "preisGesamt", unit: "€", numeric: true, computed: true },
  { key: "preisKorrosionsschutztests", unit: "€", numeric: true },
  { key: "gestellbaukosten", unit: "€", numeric: true },
  { key: "angebotsgueltigkeit", dateFormat: true },
];

export const initialOfferState = FIELDS.filter((field) => !field.synced).reduce(
  (acc, { key }) => {
    acc[key] = "";
    return acc;
  },
  { pruefungen: "", notes: "" }
);

// Preis Gesamt = Preis Beschichtung + Preis Maskierung + Preis Verpackung —
// but ONLY once all three actually have a value; two out of three isn't
// enough and must NOT show a partial sum, it stays empty until Verpackung
// (typically the last of the three to get filled in) is entered too.
// Rounded to 2 decimals as a normal final EUR amount (the per-part inputs
// it's built from carry more precision — 4dp for Beschichtung — for their
// own unit-economics purposes, but a customer-facing total reads as plain
// cents).
export function computePreisGesamt(syncedFields, values) {
  const hasEntry = (raw) => raw !== undefined && raw !== null && raw !== "";
  const b = syncedFields.preisBeschichtung;
  const m = syncedFields.preisMaskierung;
  const v = values.preisVerpackung;
  return hasEntry(b) && hasEntry(m) && hasEntry(v) ? (Number(b) + Number(m) + Number(v)).toFixed(2) : "";
}

// Feeds Document Preview's pricing/details block — same fields, same order
// as FIELDS above, but only the ones that actually have a value: a
// partially-filled form shows partial rows in the document, not placeholder
// rows for the rest. Notes is a scratch field for internal reference only
// and is deliberately excluded; Prüfungen isn't part of FIELDS (it's a
// separate textarea in the form) so it's appended by hand, in the position
// the user asked for. Angebotsgültigkeit is excluded too — it stays a
// normal, editable field in the form, it just doesn't print here: Document
// Preview's own page-2 terms section already has its own dedicated
// "Angebotsgültigkeit" line with the actual legal wording ("freibleibend"),
// so this raw per-image date would only be a confusing second one sitting
// inside the pricing block. A numeric field (has a `unit`, or is the
// German-grouped Jahresmenge) whose value is exactly 0 is also skipped —
// a "0" for a price/quantity means "not entered", not "free"/"none", so it
// shouldn't print on the offer; the 0 itself is untouched in the form/
// database, this only affects what reaches the preview. Rows carry the
// field KEY, not a translated label — DocPreview/buildDocx translate it at
// their own render time so a saved offer always reflects whatever language
// is currently selected, not whichever was active when it was saved
// (that's also where the "(one-time)"/"/ pc"/unit annotations the doc shows
// for specific fields — but the live form never does — get added).
export function buildOfferDetailsRows(values, syncedFields) {
  const rows = [];
  FIELDS.forEach(({ key, synced, format, dateFormat, unit, numeric }) => {
    if (key === "angebotsgueltigkeit") return;
    const rawValue = synced ? syncedFields[key] ?? "" : values[key];
    const displayValue =
      format === "german"
        ? formatGermanDigits(rawValue)
        : dateFormat
        ? formatDateDigits(rawValue)
        : numeric
        ? formatGermanLive(rawValue)
        : rawValue;
    if (!displayValue) return;
    if ((unit || format === "german") && Number(rawValue) === 0) return;
    rows.push([key, unit ? `${displayValue} ${unit}` : displayValue]);
  });
  if (values.pruefungen) rows.push(["pruefungen", values.pruefungen]);
  return rows;
}
