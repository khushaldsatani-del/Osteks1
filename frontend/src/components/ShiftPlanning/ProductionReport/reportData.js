// Sample figures for the Production Report, from the approved mock-up.
// The planned pieces themselves come from the Shift Planning page's plan
// for the chosen day (planStorage.js); only these extras are sample data.

// Coated pieces pre-filled for the Früh shift of a day without a saved
// report, keyed by part number (the mock-up's values).
export const SAMPLE_COATED = {
  frueh: {
    "710746S00E": 2000,
    T01122: 1400,
    T06789: 1000,
    T04175: 0,
    T09988: 900,
    T03351: 1200,
    T03434: 2000,
    T00406: 1500,
    "T02218-s01": 700,
    T04176: 1800,
  },
};

// Earlier reports shown under "Previous Reports" until real ones are saved;
// `dayOffset` is days before today. A saved report for the same day and
// shift replaces its sample row.
export const SAMPLE_PREVIOUS = [
  { dayOffset: -1, shift: "nacht", planned: 11000, coated: 10800 },
  { dayOffset: -1, shift: "spaet", planned: 14500, coated: 14500 },
  { dayOffset: -1, shift: "frueh", planned: 13000, coated: 12900 },
  { dayOffset: -2, shift: "nacht", planned: 10500, coated: 10200 },
  { dayOffset: -2, shift: "spaet", planned: 14000, coated: 13800 },
];

// The first rows of Previous Reports; "View all" shows the rest.
export const PREVIOUS_SHOWN = 5;
