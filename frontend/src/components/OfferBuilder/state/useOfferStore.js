import { useEffect, useMemo, useReducer, useRef } from "react";
import { initialState, normalizeOffer, reducer } from "./offerState";
import { DEFAULT_SETTINGS } from "../engine/defaults";
import { calcKtl } from "../engine/ktl";
import { calcPulver } from "../engine/pulver";
import { parseNum } from "../engine/format";

// The offer builder's state in one place. The offer being worked on is
// also kept in this browser, so leaving Work Place or a reload does not
// lose it before it is saved; Save puts it in the database (Work Place).
// The calculation settings are kept here too - one admin maintains them.
const KEY = "osteksOfferBuilder:v1";

// An extraction cannot still be running after a reload - such a part shows
// the upload as failed, so it can simply be uploaded again.
const settle = (offer) => ({
  ...offer,
  parts: offer.parts.map((p) =>
    p.extraction?.status === "loading" ? { ...p, extraction: { ...p.extraction, status: "error", error: "" } } : p
  ),
});

// Saved settings, value by value: one saved before it existed, or of the
// wrong kind (text for a number, no list for a cost table), gets the
// Excel default instead - damaged settings must not break the page.
const sameKind = (value, fallback) =>
  Array.isArray(fallback) ? Array.isArray(value) && value.every((row) => row && typeof row === "object") : typeof value === typeof fallback && (typeof value !== "number" || Number.isFinite(value));
const settingsFor = (defaults, saved) =>
  Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, saved && sameKind(saved[key], fallback) ? saved[key] : fallback]));
export const settingsOf = (saved) => ({
  ktl: settingsFor(DEFAULT_SETTINGS.ktl, saved?.ktl),
  pulver: settingsFor(DEFAULT_SETTINGS.pulver, saved?.pulver),
});

const load = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY));
    if (saved && typeof saved === "object") {
      return {
        process: saved.process === "pulver" ? "pulver" : "ktl",
        offers: { ktl: settle(normalizeOffer("ktl", saved.offers?.ktl)), pulver: settle(normalizeOffer("pulver", saved.offers?.pulver)) },
        settings: settingsOf(saved.settings),
      };
    }
  } catch {
    // unreadable - start fresh
  }
  return initialState();
};

export function useOfferStore() {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  // Kept in the browser 400 ms after the last change rather than on every
  // key press (a big offer with extraction texts is a lot to write each
  // time), and at once when the page is left, so nothing typed is lost.
  const latest = useRef(state);
  const pending = useRef(false);
  latest.current = state;
  const writeDraft = useRef(() => {
    if (!pending.current) return;
    pending.current = false;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(latest.current));
    } catch {
      // storage full or blocked - the app still works for this visit
    }
  }).current;
  useEffect(() => {
    pending.current = true;
    const timer = window.setTimeout(writeDraft, 400);
    return () => window.clearTimeout(timer);
  }, [state, writeDraft]);
  useEffect(() => {
    window.addEventListener("pagehide", writeDraft);
    return () => {
      window.removeEventListener("pagehide", writeDraft);
      writeDraft(); // leaving the page inside the app
    };
  }, [writeDraft]);

  const offer = state.offers[state.process];
  const settings = state.settings[state.process];
  const calc = state.process === "ktl" ? calcKtl : calcPulver;

  // every part's result, so the list and the letter show live prices. A
  // calculation that throws anyway (settings edited into something the
  // formulas cannot use) falls back to the Excel defaults for that part
  // instead of taking the page down.
  const results = useMemo(() => {
    const safeCalc = (part) => {
      try {
        return calc(part, settings);
      } catch (error) {
        console.error("Offer calculation failed - using the Excel default settings", error);
        return calc(part, DEFAULT_SETTINGS[state.process]);
      }
    };
    return Object.fromEntries(offer.parts.map((p) => [p.id, safeCalc(p)]));
  }, [offer.parts, settings, calc, state.process]);
  const selected = offer.parts.find((p) => p.id === offer.selectedId) ?? offer.parts[0];

  return { state, dispatch, offer, settings, results, selected, result: results[selected.id] };
}

// The price that goes into the letter: the typed offer price, else the
// calculated one rounded to cents.
export const priceForLetter = (part, result) => {
  const typed = parseNum(part.offerPrice);
  if (part.offerPrice !== "" && typed > 0) return typed;
  return result?.calculatedPrice == null ? null : Math.round(result.calculatedPrice * 100) / 100;
};
