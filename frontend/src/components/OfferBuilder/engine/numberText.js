import { parseNum } from "./format";

// How numbers are written in the number boxes, per language:
//   English  1,50,000.5   (lakh grouping: last three digits, then pairs)
//   German   150.000,5    (groups of three, decimal comma)
// The boxes show this while typing; what is stored for the calculation is
// always the plain number - never the formatted text.

const SEPARATORS = {
  de: { group: ".", decimal: "," },
  en: { group: ",", decimal: "." },
};

const sepOf = (language) => SEPARATORS[language] ?? SEPARATORS.de;

// "150000" -> "1,50,000" (en) / "150.000" (de)
export const groupDigits = (digits, language) => {
  if (digits.length <= 3) return digits;
  if (language === "en") {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return `${rest},${last3}`;
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// What was typed into a box -> what the box shows and the plain number.
// Grouping marks are ignored (they are added back), anything that is not a
// digit, the language's decimal mark or a leading minus is dropped, and
// only the first decimal mark counts. "150000," while typing stays
// "150.000," so the next digit can follow.
export const readTyped = (text, language) => {
  const { decimal } = sepOf(language);
  const raw = String(text ?? "").trim();
  const sign = raw.startsWith("-") ? "-" : "";
  let integer = "";
  let fraction = "";
  let hasDecimal = false;
  for (const char of raw) {
    if (char >= "0" && char <= "9") {
      if (hasDecimal) fraction += char;
      else integer += char;
    } else if (char === decimal && !hasDecimal) {
      hasDecimal = true;
    }
  }
  integer = integer.replace(/^0+(?=\d)/, "");
  if (hasDecimal && integer === "") integer = "0";
  if (!integer && !hasDecimal) return { display: sign, value: "" };
  const display = `${sign}${groupDigits(integer, language)}${hasDecimal ? decimal + fraction : ""}`;
  const value = Number(`${sign}${integer}${hasDecimal && fraction ? `.${fraction}` : ""}`);
  return { display, value: Number.isFinite(value) ? value : "" };
};

// A stored value (a number, or older typed text like "10.000" / "0,4")
// as the box shows it. "" stays empty.
export const showValue = (value, language) => {
  if (value === "" || value == null) return "";
  const n = parseNum(value);
  if (!Number.isFinite(n)) return "";
  const { decimal } = sepOf(language);
  const [integer, fraction] = Math.abs(n)
    .toFixed(10)
    .replace(/0+$/, "")
    .replace(/\.$/, "")
    .split(".");
  return `${n < 0 ? "-" : ""}${groupDigits(integer, language)}${fraction ? decimal + fraction : ""}`;
};

// A placeholder that is a plain number ("2.5", "120") in the box's style;
// anything else ("–", "0,23" already formatted) stays as it is.
export const showPlaceholder = (text, language) =>
  typeof text === "string" && /^-?\d+(\.\d+)?$/.test(text.trim()) ? showValue(Number(text), language) : text;

// Where the caret belongs in the new text: after as many digits / decimal
// marks / minus signs as there were before it in what was typed.
export const caretAfter = (typedBefore, display, language) => {
  const { decimal } = sepOf(language);
  const counts = (char) => (char >= "0" && char <= "9") || char === decimal || char === "-";
  let wanted = [...typedBefore].filter(counts).length;
  if (wanted === 0) return 0;
  for (let i = 0; i < display.length; i += 1) {
    if (counts(display[i])) {
      wanted -= 1;
      if (wanted === 0) return i + 1;
    }
  }
  return display.length;
};
