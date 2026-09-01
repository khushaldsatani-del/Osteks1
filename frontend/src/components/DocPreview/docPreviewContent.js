// Single source of truth for the Angebot document's content — both the
// on-screen JSX preview and the Word (.doc) export read from these same
// arrays, so the two can never drift apart. Static sample content for now;
// swapping this for real Extracted Details / Offer Details / Calculation
// values is a follow-up step.
//
// Locale-aware: call getDocPreviewContent(language) to get the right set.
// German content is the original; English is a natural business-letter
// translation, not word-for-word — proper nouns (company name, addresses,
// the recipient's name, phone/email/website) are never translated in
// either language, since they're facts, not language content.

const CONTENT_DE = {
  LETTERHEAD: {
    company: "OSTEKS GMBH",
    sub: "Oberflächen Systemtechnik Elterlein",
  },

  RETURN_ADDRESS: "OSTEKS GmbH  Am Gansberg 2  09481 Elterlein",

  RECIPIENT_LINES: [
    "Vollmann Group - Kundenteam",
    "SYNTEKS Umformtechnik GmbH",
    "Herr Könsgen",
    "Am Gansberg 9",
    "09481 Elterlein (Deutschland)",
  ],

  CONTACT_ROWS: [
    ["Telefon", "037349 134-43"],
    ["Telefax", "037349 134-10"],
    ["E-Mail", "scholz@osteks.de"],
    ["Internet", "www.osteks.de"],
  ],

  HEADING_ROWS: [
    ["Projekt", "Batteriehalter E-Crafter"],
    ["Angebot Nr.", "32258-00099"],
  ],

  SALUTATION: "Sehr geehrter Herr Könsgen,",

  INTRO_LINES: [
    "wir bedanken uns für Ihre Anfrage vom 16.07.2025.",
    "Nachstehend erhalten Sie unser Angebot, das wir nach Ihren Informationen erstellt haben.",
  ],

  // The "specification" block toggled by the With/Without Specification radios.
  SPEC_FIELD_ROWS: [
    ["Beschichtung:", ["Kathodische Tauchlackierung schwarz"]],
    ["Vorbehandlung:", ["Entfettet, Tri-Kat-Zinkphosphatierung, chromfrei"]],
    [
      "Anlieferzustand:",
      [
        "metallisch blank, silikonfrei, leicht geölt (Beölungsgrad max. 2,0-2,5g/m², gem. VDA 230-213); sowie frei von löt-, Schweiß-, Laser- und Trennmittelrückständen, in beschichtbarem Zustand. (siehe Spezifikationen KTL in den AGB's Firma Osteks GmbH)",
        "Anlieferungszustand während der Serie wie bemustert und freigegeben.",
      ],
    ],
    ["Anteilige Rüstkosten:", ["Im Stückpreis enthalten."]],
    ["Ausschussquote:", ["Vereinbarung nach Serienstart"]],
  ],

  PAGE1_DISCLAIMER:
    "Wir weisen darauf hin, dass eine KTL-Beschichtung nicht Steinschlag- und Freibewitterungsbeständig ist. Die Machbarkeit bzw. erzielbare Qualität der Beschichtung können wir erst nach Erhalt von ersten Musterteilen und nach Durchführung von Lackierversuchen festlegen.",

  // First bold paragraph on page 2 — the ONE piece of content the With/
  // Without Specification toggle actually changes (see DocPreview.jsx).
  // Everything else on that page, and the Coating/Pre-treatment/etc. field
  // list above, is now shown unconditionally regardless of the toggle.
  // "Ohne Gewindemaskierung" (without thread masking) / "Mit Gewinde-
  // maskierung" (with thread masking) — the toggle is still labeled With/
  // Without Specification in the UI, but this is what that choice actually
  // controls: whether the quoted price already includes covers/masking or
  // not.
  WITHOUT_SPEC_NOTE:
    "Der Angebotspreis versteht sich ohne Abdeckungen und ohne Überprüfung von Gewindegängigkeiten/Passgenauigkeiten und Funktionsprüfungen. Für eventuell notwendige Abdeckungen fallen zusätzliche Kosten an.",
  WITH_SPEC_NOTE:
    "Der Angebotspreis versteht sich inkl. Abdeckungen jedoch ohne Überprüfung von Gewindegängigkeiten/Passgenauigkeiten und Funktionsprüfungen. Für eventuell notwendige Prüfungen fallen zusätzliche Kosten an.",

  PAGE2_BOLD_PARAGRAPHS: [
    "Die Kalkulation basiert darauf, dass es sich um Teile ohne Sichtbereiche und ohne dekorative Merkmale handelt.",
    "Nach Erhalt einer Verpackungsvorschrift und nach Prüfung des Verpackungsaufwandes behalten wir uns eine Angebotsprüfung vor.",
    "An Schweißnähten besteht (je nach Rohteilqualität) Gefahr von mangelnder Haftung bzw. Fehlstellen der KTL-Beschichtung.",
    "Geometrie- und prozessbedingt kann es an dem angebotenen Teil zur von uns nicht beeinflussbaren und somit zulässigen Bildung von Luftblasen und zu Lackanhäufungen und Lackläufern kommen. Ein Nacharbeiten der Merkmale ist nicht im Angebot enthalten.",
    "Anteilige Einmalkosten für einen Erstmusterprüfbericht nach VDA bzw. PPAP: 500,- €. Bei Erhalt des Serienauftrags keine. Sonderprüfungen werden nach Aufwand berechnet.",
  ],

  TERMS_ROWS: [
    ["Anlieferung:", "Frei Haus Elterlein, Am Gansberg 2"],
    ["Rücklieferung:", "Ab Werk Elterlein, Am Gansberg 2"],
    ["Verpackung:", "lagenweise in kostenlos beigestellten sauberen kundeneigenen Behältern, Behälter stapelbar."],
    [
      "Lieferzeit:",
      "ca. 5 – 10 Arbeitstage nach Wareneingang und Klärung aller offenen Fragen bzw. nach besonderer Vereinbarung",
    ],
    ["Zahlung:", "30 Tage netto"],
    ["Angebotsgültigkeit:", "freibleibend"],
  ],

  // Not part of TERMS_ROWS — its value is computed live (today + 3 months,
  // same rule as Offer Details' own Angebotsgültigkeit default), so it's
  // appended as its own row at render time via getPriceValidityDateLine()
  // below, the same way the letter's own date line already works.
  PRICE_VALIDITY_LABEL: "Preisgültigkeit:",

  CLOSING_LINE: "Wir verweisen auf unsere Allgemeinen Verkaufsbedingungen.",
};

const CONTENT_EN = {
  LETTERHEAD: {
    company: "OSTEKS GMBH",
    sub: "Surface Systems Technology Elterlein",
  },

  RETURN_ADDRESS: "OSTEKS GmbH  Am Gansberg 2  09481 Elterlein",

  RECIPIENT_LINES: [
    "Vollmann Group - Customer Team",
    "SYNTEKS Umformtechnik GmbH",
    "Mr. Könsgen",
    "Am Gansberg 9",
    "09481 Elterlein (Germany)",
  ],

  CONTACT_ROWS: [
    ["Phone", "037349 134-43"],
    ["Fax", "037349 134-10"],
    ["Email", "scholz@osteks.de"],
    ["Website", "www.osteks.de"],
  ],

  HEADING_ROWS: [
    ["Project", "Battery Holder E-Crafter"],
    ["Offer No.", "32258-00099"],
  ],

  SALUTATION: "Dear Mr. Könsgen,",

  INTRO_LINES: [
    "thank you for your inquiry dated 16.07.2025.",
    "Please find below our offer, prepared according to the information you provided.",
  ],

  SPEC_FIELD_ROWS: [
    ["Coating:", ["Cathodic dip coating, black"]],
    ["Pre-treatment:", ["Degreased, tri-cation zinc phosphating, chromium-free"]],
    [
      "Delivery condition:",
      [
        "Bare metal, silicone-free, lightly oiled (oil coverage max. 2.0-2.5 g/m², per VDA 230-213); free of soldering, welding, laser, and release-agent residues, in a coatable condition. (See KTL specifications in the General Terms and Conditions of Osteks GmbH)",
        "Delivery condition during series production as sampled and approved.",
      ],
    ],
    ["Pro-rata setup costs:", ["Included in the unit price."]],
    ["Scrap rate:", ["To be agreed after start of series production"]],
  ],

  PAGE1_DISCLAIMER:
    "Please note that a KTL (cathodic dip) coating is not resistant to stone chipping or prolonged outdoor weathering. We can only determine the feasibility and achievable coating quality after receiving initial sample parts and conducting coating trials.",

  // "Without thread masking" / "with thread masking" — the toggle is
  // still labeled With/Without Specification in the UI, but this is what
  // that choice actually controls: whether the quoted price already
  // includes covers/masking or not.
  WITHOUT_SPEC_NOTE:
    "The quoted price does not include covers, the verification of thread engagement or fit, or functional testing. Additional costs apply for any covers that may be required.",
  WITH_SPEC_NOTE:
    "The quoted price includes covers/masking, but does not include the verification of thread engagement or fit, or functional testing. Additional costs apply for any testing that may be required.",

  PAGE2_BOLD_PARAGRAPHS: [
    "The calculation assumes the parts have no visible surfaces or decorative features.",
    "Upon receipt of packaging instructions and after reviewing the packaging effort involved, we reserve the right to review this offer.",
    "Depending on raw part quality, there is a risk of insufficient adhesion or defects in the KTL coating at weld seams.",
    "Due to the part's geometry and the coating process, the formation of air bubbles, paint build-up, and paint runs may occur on the offered part — factors beyond our control and therefore considered acceptable. Reworking of these characteristics is not included in this offer.",
    "Pro-rata one-time costs for an initial sample inspection report per VDA or PPAP: €500. No charge upon receipt of the series production order. Special inspections will be billed based on actual effort.",
  ],

  TERMS_ROWS: [
    ["Delivery:", "Free domicile Elterlein, Am Gansberg 2"],
    ["Return delivery:", "Ex works Elterlein, Am Gansberg 2"],
    ["Packaging:", "Layered in clean, customer-supplied containers provided free of charge; containers stackable."],
    [
      "Delivery time:",
      "approx. 5 – 10 working days after goods receipt and clarification of all open questions, or as otherwise agreed",
    ],
    ["Payment:", "30 days net"],
    ["Offer validity:", "subject to change"],
  ],

  PRICE_VALIDITY_LABEL: "Price validity:",

  CLOSING_LINE: "We refer you to our General Terms and Conditions of Sale.",
};

// The letter's date line is always today's date, not a fixed sample value —
// computed live (e.g. "14. August 2026" / "14 August 2026") rather than
// stored as a constant, so both the preview and the download always show
// the day the document was actually generated, in the currently selected
// language's date convention.
function getTodayDateLine(language) {
  const locale = language === "DE" ? "de-DE" : "en-GB";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date());
}

// Adds `months` to `date`, clamping to the target month's last day instead
// of overflowing into the month after (JS Date's native behavior) — e.g.
// 31 Aug + 3 months lands on 30 Nov, not 1 Dec. Same rule OfferDetails.jsx
// uses for its own Angebotsgültigkeit default (duplicated locally here
// rather than imported, to keep this content module standalone).
function addMonthsClamped(date, months) {
  const targetMonthIndex = date.getMonth() + months;
  const lastDayOfTargetMonth = new Date(date.getFullYear(), targetMonthIndex + 1, 0).getDate();
  const day = Math.min(date.getDate(), lastDayOfTargetMonth);
  return new Date(date.getFullYear(), targetMonthIndex, day);
}

// Parses OfferDetails.jsx's raw DDMMYYYY digit storage (see its own
// formatDateDigits/handleDateChange) into a Date, or null if it isn't a
// complete, valid date yet (still mid-typing, or never set). Round-trips
// year/month/day through the constructed Date to reject nonsense like day
// 31 in a 30-day month rather than silently rolling it into the next month.
function parseDDMMYYYYDigits(digits) {
  const clean = String(digits ?? "").replace(/\D/g, "");
  if (clean.length !== 8) return null;
  const dd = Number(clean.slice(0, 2));
  const mm = Number(clean.slice(2, 4));
  const yyyy = Number(clean.slice(4, 8));
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

// "Preisgültigkeit"/"Price validity" — always Angebotsgültigkeit (Offer
// Details' own offer-validity field, passed in here as its raw DDMMYYYY
// digits) plus 3 months, live: today by default (Angebotsgültigkeit's own
// default), or 3 months past whatever date the user has typed there instead
// — never computed independently of it. Falls back to today + 3 months only
// if no usable digits were passed in at all (e.g. nothing mounted yet).
// Always a plain dd.mm.yyyy numeric date (matching this field's original
// static content, which used the same digit format regardless of language —
// unlike the letter's own date line above, which spells the month out per
// locale).
function getPriceValidityDateLine(angebotsgueltigkeitDigits) {
  const base = parseDDMMYYYYDigits(angebotsgueltigkeitDigits) ?? new Date();
  const d = addMonthsClamped(base, 3);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export function getDocPreviewContent(language) {
  const content = language === "DE" ? CONTENT_DE : CONTENT_EN;
  return { ...content, getTodayDateLine: () => getTodayDateLine(language), getPriceValidityDateLine };
}
