// Single source of truth for the Angebot document's content — both the
// on-screen JSX preview and the Word (.doc) export read from these same
// arrays, so the two can never drift apart. Static sample content for now;
// swapping this for real Extracted Details / Offer Details / Calculation
// values is a follow-up step.

export const LETTERHEAD = {
  company: "OSTEKS GMBH",
  sub: "Oberflächen Systemtechnik Elterlein",
};

export const RETURN_ADDRESS = "OSTEKS GmbH  Am Gansberg 2  09481 Elterlein";

export const RECIPIENT_LINES = [
  "Vollmann Group - Kundenteam",
  "SYNTEKS Umformtechnik GmbH",
  "Herr Könsgen",
  "Am Gansberg 9",
  "09481 Elterlein (Germany)",
];

export const CONTACT_ROWS = [
  ["Telefon", "037349 134-43"],
  ["Telefax", "037349 134-10"],
  ["E-Mail", "scholz@osteks.de"],
  ["Internet", "www.osteks.de"],
];

// The letter's date line is always today's date, not a fixed sample value
// — computed live (e.g. "14. August 2026") rather than stored as a
// constant, so both the preview and the download always show the day the
// document was actually generated.
export function getTodayDateLine() {
  return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
}

export const HEADING_ROWS = [
  ["Projekt", "Batteriehalter E-Crafter"],
  ["Angebot Nr.", "32258-00099"],
];

export const SALUTATION = "Sehr geehrter Herr Könsgen,";

export const INTRO_LINES = [
  "wir bedanken uns für Ihre Anfrage vom 16.07.2025.",
  "Nachstehend erhalten Sie unser Angebot, das wir nach Ihren Informationen erstellt haben.",
];

// The "specification" block toggled by the With/Without Specification radios.
export const SPEC_FIELD_ROWS = [
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
];

export const PAGE1_DISCLAIMER =
  "Wir weisen darauf hin, dass eine KTL-Beschichtung nicht Steinschlag- und Freibewitterungsbeständig ist. Die Machbarkeit bzw. erzielbare Qualität der Beschichtung können wir erst nach Erhalt von ersten Musterteilen und nach Durchführung von Lackierversuchen festlegen.";

export const PAGE2_BOLD_PARAGRAPHS = [
  "Der Angebotspreis versteht sich ohne Abdeckungen und ohne Überprüfung von Gewindegängigkeiten/Passgenauigkeiten und Funktionsprüfungen. Für eventuell notwendige Abdeckungen fallen zusätzliche Kosten an.",
  "Die Kalkulation basiert darauf, dass es sich um Teile ohne Sichtbereiche und ohne dekorative Merkmale handelt.",
  "Nach Erhalt einer Verpackungsvorschrift und nach Prüfung des Verpackungsaufwandes behalten wir uns eine Angebotsprüfung vor.",
  "An Schweißnähten besteht (je nach Rohteilqualität) Gefahr von mangelnder Haftung bzw. Fehlstellen der KTL-Beschichtung.",
  "Geometrie- und prozessbedingt kann es an dem angebotenen Teil zur von uns nicht beeinflussbaren und somit zulässigen Bildung von Luftblasen und zu Lackanhäufungen und Lackläufern kommen. Ein Nacharbeiten der Merkmale ist nicht im Angebot enthalten.",
  "Anteilige Einmalkosten für einen Erstmusterprüfbericht nach VDA bzw. PPAP: 500,- €. Bei Erhalt des Serienauftrags keine. Sonderprüfungen werden nach Aufwand berechnet.",
];

export const TERMS_ROWS = [
  ["Anlieferung:", "Frei Haus Elterlein, Am Gansberg 2"],
  ["Rücklieferung:", "Ab Werk Elterlein, Am Gansberg 2"],
  ["Verpackung:", "lagenweise in kostenlos beigestellten sauberen kundeneigenen Behältern, Behälter stapelbar."],
  [
    "Lieferzeit:",
    "ca. 5 – 10 Arbeitstage nach Wareneingang und Klärung aller offenen Fragen bzw. nach besonderer Vereinbarung",
  ],
  ["Zahlung:", "30 Tage netto"],
  ["Angebotsgültigkeit:", "freibleibend"],
  ["Preisgültigkeit:", "16.10.2025"],
];

export const CLOSING_LINE = "Wir verweisen auf unsere Allgemeinen Verkaufsbedingungen.";
