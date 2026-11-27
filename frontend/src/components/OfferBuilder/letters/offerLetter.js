import { getDocPreviewContent } from "../../DocPreview/docPreviewContent";
import { buildOfferDetailsRows } from "../../OfferDetails/offerDetailsRows";
import { addDaysIso, parseNum } from "../engine/format";
import { priceForLetter } from "../state/useOfferStore";

// The offer letter is Work Place's own Document Preview - same page layout,
// same PDF / Word download - fed from the offer builder instead of the old
// Firma Information / Offer Details forms. KTL shows Document Preview's own
// texts; Powder shows the texts of "Angebot 32484-00014" in that same
// layout. Texts edited in "Customer & offer" replace the standard ones.

const qtyOf = (p) => parseNum(p.quantity);

// The recipient's address as typed - one line per row. Offers saved before
// the single address field still carry street and city; those are read
// as the address until it is edited.
export const addressOf = (c) => c.address ?? [c.street, c.city].filter((line) => line && line.trim()).join("\n");

// A part nobody has started (no name, no quantity) stays out of the letter.
export const isUsedPart = (p) => !!(String(p.name ?? "").trim() || qtyOf(p));

const withoutColon = (label) => String(label ?? "").replace(/:\s*$/, "");
const withColon = (label) => `${withoutColon(label)}:`;
const appLanguage = (language) => (language === "en" ? "EN" : "DE");

// The standard texts of one process, in the form "Customer & offer" edits:
// spec and terms as { label, text } rows, paragraphs as plain text (the
// first one is the bold line after the price block, the rest follow on).
const standardTexts = (process, language, t) => {
  if (process === "pulver") {
    return {
      spec: t("letter.pulver.spec").map(([label, text]) => ({ label, text })),
      paragraphs: [...t("letter.pulver.paragraphs")],
      terms: t("letter.pulver.terms").map(([label, text]) => ({ label, text })),
    };
  }
  const content = getDocPreviewContent(appLanguage(language));
  return {
    spec: content.SPEC_FIELD_ROWS.map(([label, lines]) => ({ label: withoutColon(label), text: lines.join("\n") })),
    paragraphs: [content.PAGE1_DISCLAIMER, ...content.PAGE2_BOLD_PARAGRAPHS],
    terms: content.TERMS_ROWS.map(([label, text]) => ({ label: withoutColon(label), text })),
  };
};

// The letter's editable texts for one language: this offer's edits if
// there are any, otherwise the standard texts.
export const letterTexts = (offer, process, language, t) => offer.texts?.[language] ?? standardTexts(process, language, t);

// "2026-11-26" -> "26112026" (Document Preview's date digits)
const isoToDigits = (iso) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return match ? `${match[3]}${match[2]}${match[1]}` : "";
};

// Powder prices hold 14 days from the offer date (Angebot 32484-00014);
// KTL keeps Document Preview's own "offer date + 3 months".
const powderValidity = (offerDate) => () => {
  const iso = addDaysIso(offerDate, 14);
  const [y, m, d] = (iso ?? "").split("-");
  return y ? `${d}.${m}.${y}` : "";
};

// Replacements for Document Preview's standard content - none for an
// unedited KTL offer, so that letter stays exactly Document Preview's.
const contentOverrides = (process, offer, language, t) => {
  const edited = offer.texts?.[language];
  if (process === "ktl" && !edited) return undefined;
  const texts = letterTexts(offer, process, language, t);
  const paragraphs = texts.paragraphs.map((p) => p.trim()).filter(Boolean);
  return {
    SPEC_FIELD_ROWS: texts.spec.filter((row) => row.text.trim()).map((row) => [withColon(row.label), row.text.split("\n")]),
    PAGE1_DISCLAIMER: paragraphs[0] ?? "",
    PAGE2_BOLD_PARAGRAPHS: paragraphs.slice(1),
    TERMS_ROWS: texts.terms.filter((row) => row.text.trim()).map((row) => [withColon(row.label), row.text]),
    ...(process === "pulver" ? { WITH_SPEC_NOTE: t("letter.pulver.withSpecNote"), getPriceValidityDateLine: powderValidity(offer.offerDate) } : {}),
  };
};

// One part's rows in Document Preview's price block. KTL uses the exact
// row builder Offer Details used (same keys, same formatting), so a part
// with masking points also gets the old offer's "Preis Maskierung … / Stk"
// line (the builder leaves it out at 0), and the one-time costs print with
// "(einmalig)" when typed in; Powder lists the rows of Angebot 32484-00014.
const partRows = (process, part, result, language) => {
  const price = priceForLetter(part, result);
  if (process === "ktl") {
    const masking = result?.old?.maskingCost;
    const oneTime = (value) => (parseNum(value) > 0 ? parseNum(value).toFixed(2) : "");
    return buildOfferDetailsRows(
      {
        teilebezeichnung: part.name ?? "",
        zeichnungsnummer: part.drawingNo ?? "",
        lackiervorschrift: part.paintSpec ?? "",
        preisKorrosionsschutztests: oneTime(part.testCost),
        gestellbaukosten: oneTime(part.rackCost),
      },
      {
        schichtdicke: part.layer ?? "",
        jahresmenge: qtyOf(part) ? String(Math.round(qtyOf(part))) : "",
        preisBeschichtung: price == null ? "" : price.toFixed(2),
        preisMaskierung: masking > 0 ? masking.toFixed(2) : "",
      }
    );
  }
  const pcs = language === "en" ? "pc" : "Stk."; // as Document Preview's own per-piece suffix
  const euro = (value) => `${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € / ${pcs}`;
  const rows = [];
  const push = (key, value) => value && rows.push([key, value]);
  push("teilebezeichnung", part.name);
  push("artikelbezeichnung", part.description);
  push("artikelnummer", part.customerArticleNo);
  push("artikelnummerOsteks", part.osteksArticleNo);
  if (qtyOf(part)) push("losgroesse", `${Math.round(qtyOf(part)).toLocaleString("de-DE")} ${pcs}`);
  if (price != null) push("preis", euro(price));
  return rows;
};

// Everything Document Preview needs for this offer.
export const docPreviewInput = (process, offer, results, language, t) => {
  const c = offer.customer;
  return {
    firmaInfo: {
      companyName: c.company ?? "",
      name: c.person ?? "",
      address: addressOf(c),
      offerNumber: offer.offerNo ?? "",
      projectName: offer.project ?? "",
      enquiryDate: offer.requestDate ?? "",
    },
    offerDetailsRowsList: (() => {
      const list = offer.parts.filter(isUsedPart).map((p) => partRows(process, p, results[p.id], language));
      return list.length ? list : [[]];
    })(),
    angebotsgueltigkeitDigits: isoToDigits(offer.offerDate),
    contentOverrides: contentOverrides(process, offer, language, t),
  };
};
