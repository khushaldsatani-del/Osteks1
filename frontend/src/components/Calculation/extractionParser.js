// Parses the raw AI drawing-extraction summary (backend/prompts/extractionPrompt.js
// "OUTPUT FORMAT") into the handful of Calculation fields it can auto-fill.
// The summary is plain "Label: value" lines — single-part drawings use
// "Weight"/"Material"/"Sheet Thickness", assemblies use "Assembly Weight"/
// "Main Material"/"Main Sheet Thickness" instead, so both are checked.

const NOT_SPECIFIED = /not specified/i;

function parseLines(summary) {
  const map = {};
  summary.split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const label = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (label) map[label] = value;
  });
  return map;
}

function firstSpecified(map, labels) {
  for (const label of labels) {
    const value = map[label];
    if (value && !NOT_SPECIFIED.test(value)) return value;
  }
  return undefined;
}

// "192 g", "0.192 kg", "1,00 mm" -> { value: 192, unit: "g" }
function parseNumberWithUnit(text) {
  if (!text) return null;
  const match = text.replace(",", ".").match(/(-?\d+(?:\.\d+)?)\s*([a-zA-Zµ]*)/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  return { value, unit: match[2].toLowerCase() };
}

// Avoids floating-point artifacts (e.g. 1.0000000000001) from unit math.
function trimNumber(n) {
  return String(Number(n.toFixed(3)));
}

function toGrams(text) {
  const parsed = parseNumberWithUnit(text);
  if (!parsed) return undefined;
  const grams = parsed.unit === "kg" ? parsed.value * 1000 : parsed.value;
  return trimNumber(grams);
}

function toMillimeters(text) {
  const parsed = parseNumberWithUnit(text);
  if (!parsed) return undefined;
  let mm = parsed.value;
  if (parsed.unit === "cm") mm *= 10;
  else if (parsed.unit === "m") mm *= 1000;
  else if (parsed.unit === "um" || parsed.unit === "µm") mm /= 1000;
  return trimNumber(mm);
}

function toMicrometers(text) {
  const parsed = parseNumberWithUnit(text);
  if (!parsed) return undefined;
  let um = parsed.value;
  if (parsed.unit === "mm") um *= 1000;
  else if (parsed.unit === "cm") um *= 10000;
  return trimNumber(um);
}

// "330155.44 mm²", "0.33 m2", "3301,55 cm²" -> square millimeters.
// Source values can come from a drawing, an email body, or an embedded
// image OCR pass — this only ever converts, it never invents a value: an
// unrecognized/missing unit returns undefined, same as the other
// converters above.
function toSquareMillimeters(text) {
  if (!text) return undefined;
  const match = text.replace(",", ".").match(/(-?\d+(?:\.\d+)?)\s*(mm²|mm2|cm²|cm2|m²|m2)/i);
  if (!match) return undefined;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return undefined;
  const unit = match[2].toLowerCase().replace("²", "2");
  let mm2 = value;
  if (unit === "cm2") mm2 *= 100;
  else if (unit === "m2") mm2 *= 1_000_000;
  return trimNumber(mm2);
}

// Quantities (annual/lifetime piece counts) are never fractional, so
// stripping every "." and "," grouping character before parsing sidesteps
// the German-vs-English thousands-separator ambiguity entirely: "43.000"
// (German) and "80,000" (English) both correctly become 43000/80000
// without needing to detect which locale wrote the source text.
function parseQuantity(text) {
  if (!text) return undefined;
  const match = text.match(/[\d.,]+/);
  if (!match) return undefined;
  const digitsOnly = match[0].replace(/[.,]/g, "");
  if (!digitsOnly) return undefined;
  const value = parseInt(digitsOnly, 10);
  return Number.isNaN(value) ? undefined : String(value);
}

// Matches the drawing's material text to one of ExtractedDetails' fixed
// DENSITY_OPTIONS (7.85 Steel / 2.70 Aluminium / 8.90 Copper) — the
// extraction gives free text, the field is a closed dropdown, so this is a
// best-effort keyword match rather than an exact value round-trip.
function matchDensity(material) {
  if (!material) return undefined;
  const text = material.toLowerCase();
  if (text.includes("alumin")) return "2.70";
  if (text.includes("steel") || text.includes("stahl")) return "7.85";
  if (text.includes("copper") || text.includes("kupfer")) return "8.90";
  return undefined;
}

export function parseExtractionSummary(summary) {
  if (!summary || typeof summary !== "string") return {};
  const map = parseLines(summary);

  const weightText = firstSpecified(map, ["Weight", "Assembly Weight"]);
  const sheetThicknessText = firstSpecified(map, ["Sheet Thickness", "Main Sheet Thickness"]);
  const materialText = firstSpecified(map, ["Material", "Main Material"]);
  const coatingThicknessText = firstSpecified(map, ["Coating Thickness"]);
  const surfaceAreaText = firstSpecified(map, ["Surface Area"]);
  const annualQuantityText = firstSpecified(map, ["Annual Quantity"]);

  const result = {};

  const weightG = toGrams(weightText);
  if (weightG !== undefined) result.weightG = weightG;

  // The drawing's "Sheet Thickness" maps into the form's "Coating
  // Thickness" field (state key thicknessMm) — per explicit request, not a
  // mismatch between the two labels.
  const thicknessMm = toMillimeters(sheetThicknessText);
  if (thicknessMm !== undefined) result.thicknessMm = thicknessMm;

  const densityGcm3 = matchDensity(materialText);
  if (densityGcm3 !== undefined) result.densityGcm3 = densityGcm3;

  // "Coating Thickness" (a numeric coating spec, e.g. "35 µm") is a
  // genuinely separate field from thicknessMm above — feeds the
  // Extracted Details' own coating-thickness-in-microns field.
  const schichtdickeUm = toMicrometers(coatingThicknessText);
  if (schichtdickeUm !== undefined) result.schichtdickeUm = schichtdickeUm;

  // An explicit Surface Area (from a drawing, an email, or an embedded
  // image OCR pass) is authoritative — it must never be silently
  // recalculated from weight/thickness/density. Setting the value alone
  // isn't enough: calculationDefaults.js's computeCalcResults blanks
  // surfaceAreaMm2/M2 back out before every recompute unless
  // touched.surfaceArea is true, exactly the same mechanism that already
  // protects a value the user typed in by hand. `_surfaceAreaExplicit` is
  // a signal for the caller (Documents.jsx) to set that flag — it is not
  // itself a calc field and must be stripped before merging into values.
  const surfaceAreaMm2 = toSquareMillimeters(surfaceAreaText);
  if (surfaceAreaMm2 !== undefined) {
    result.surfaceAreaMm2 = surfaceAreaMm2;
    result.surfaceAreaM2 = trimNumber(Number(surfaceAreaMm2) / 1_000_000);
    result._surfaceAreaExplicit = true;
  }

  const quantity = parseQuantity(annualQuantityText);
  if (quantity !== undefined) result.quantity = quantity;

  return result;
}

// Offer Details' Teilebezeichnung / Zeichnungsnummer / Lackiervorschrift are
// direct text mirrors of the drawing's Part Name / Part Number / Surface
// Treatment — no unit conversion or matching needed, just pass the text
// through when the drawing actually specified it.
export function parseOfferDetailsFields(summary) {
  if (!summary || typeof summary !== "string") return {};
  const map = parseLines(summary);

  const result = {};
  const partName = firstSpecified(map, ["Part Name"]);
  if (partName !== undefined) result.teilebezeichnung = partName;

  const partNumber = firstSpecified(map, ["Part Number"]);
  if (partNumber !== undefined) result.zeichnungsnummer = partNumber;

  const surfaceTreatment = firstSpecified(map, ["Surface Treatment"]);
  if (surfaceTreatment !== undefined) result.lackiervorschrift = surfaceTreatment;

  return result;
}
