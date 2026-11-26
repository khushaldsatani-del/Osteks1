import { parseExtractionSummary, parseOfferDetailsFields } from "../../Calculation/extractionParser";
import { MATERIALS } from "../engine/defaults";

// What an uploaded drawing / email fills into a part - read with the same
// parsers the old Calculation / Offer Details forms used, so extraction
// works exactly as before. Only what the drawing actually states is filled
// in; everything else keeps what the part already has.

const text = (value) => (value === undefined || value === null || value === "" ? undefined : String(value));
const positive = (value) => (Number(value) > 0 ? String(value) : undefined);

// the drawing's material density (7.85, 2.7 ...) -> the Powder material list
const materialOf = (density) => {
  const d = Number(density);
  if (!Number.isFinite(d) || d <= 0) return undefined;
  const near = MATERIALS.map((m) => ({ key: m.key, diff: Math.abs((m.density ?? 7.85) - d) })).sort((a, b) => a.diff - b.diff)[0];
  return near && near.diff <= 0.1 ? near.key : undefined;
};

// a coating thickness for the letter: "35" -> "35 µm", "15-30 µm" stays
const layerText = (value) => {
  const v = text(value);
  if (!v) return undefined;
  return /[µμ]m/i.test(v) ? v : `${v} µm`;
};

export function partFromExtraction(process, summary) {
  const values = parseExtractionSummary(summary);
  const fields = parseOfferDetailsFields(summary);
  const changes = {
    name: text(fields.teilebezeichnung),
    quantity: positive(values.quantity),
    weightG: positive(values.weightG),
    thicknessMm: positive(values.thicknessMm),
  };
  if (process === "ktl") {
    Object.assign(changes, {
      drawingNo: text(fields.zeichnungsnummer),
      paintSpec: text(fields.lackiervorschrift),
      layer: layerText(values.schichtdickeUm),
      surfaceMm2: positive(values.surfaceAreaMm2),
    });
  } else {
    const mm2 = Number(values.surfaceAreaMm2);
    Object.assign(changes, {
      customerArticleNo: text(fields.zeichnungsnummer),
      material: materialOf(values.densityGcm3),
      surfaceCm2: mm2 > 0 ? String(Math.round(mm2) / 100) : undefined,
      layerUm: /^\d+(\.\d+)?$/.test(String(values.schichtdickeUm ?? "")) ? String(values.schichtdickeUm) : undefined,
    });
  }
  return Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
}

// The norm's thickness from the standards library ("15-30 µm", "≥ 8 µm"),
// used for a KTL part whose drawing gave no coating thickness of its own -
// same fallback the old Extracted Details used.
export function layerFromKb(kbSpecification) {
  const thickness = kbSpecification?.thickness;
  if (!thickness) return undefined;
  if (thickness.display) return thickness.display;
  return thickness.min === thickness.max ? `${thickness.min} ${thickness.unit}` : `${thickness.min}-${thickness.max} ${thickness.unit}`;
}

// the norm text of a part, for the standards lookup and the Test Report
export const normOf = (part) => part.paintSpec || parseOfferDetailsFields(part.extraction?.summary).lackiervorschrift || "";
