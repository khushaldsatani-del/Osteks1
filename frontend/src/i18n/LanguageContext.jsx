import { useContext } from "react";
import { LanguageContext } from "./context";
import en from "./translations/en";
import de from "./translations/de";

// Hooks + translation lookup only — no component, no createContext() call
// (that lives in context.js) — see context.js's comment for why this file
// is split the way it is.
export const DICTIONARIES = { EN: en, DE: de };
export const LANGUAGE_STORAGE_KEY = "appLanguage";

function resolveKey(dict, key) {
  return key.split(".").reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), dict);
}

// Simple {placeholder} substitution — the only interpolation shape this
// app's dynamic strings need (e.g. "Showing {from} to {to} of {total}
// files"), no plural/ICU rules required for two fixed languages.
function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

// A missing key never throws or renders blank — it falls back to the EN
// string, then to the raw key itself, so a translation gap is visible
// (shows up as a literal "section.key" in the UI) and diagnosable rather
// than silently breaking the page.
export function translate(language, key, vars) {
  const template = resolveKey(DICTIONARIES[language], key) ?? resolveKey(DICTIONARIES.EN, key) ?? key;
  if (typeof template !== "string") return key;
  return interpolate(template, vars);
}

function useLanguageContext() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage/useTranslation must be used within a LanguageProvider");
  return ctx;
}

export function useLanguage() {
  const { language, setLanguage } = useLanguageContext();
  return { language, setLanguage };
}

export function useTranslation() {
  const { t, language } = useLanguageContext();
  return { t, language };
}
