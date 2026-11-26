import en from "../../../i18n/translations/en";
import de from "../../../i18n/translations/de";

// The offer builder's text lookup, without React: its texts live in the
// app's dictionaries under "offerBuilder". Some entries are lists (the
// letter's standard texts), which the app's own t() only returns as
// strings; German is the fallback, as in the sheets.
const DICTIONARIES = { de: de.offerBuilder, en: en.offerBuilder };

// en-IN: English with lakh grouping (1,50,000.50), as the number boxes
// write it; de-DE: 150.000,50
export const LOCALES = { de: "de-DE", en: "en-IN" };

const read = (dict, key) => key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);

export const makeT = (language) => {
  const own = DICTIONARIES[language] ?? DICTIONARIES.de;
  return (key, vars) => {
    const value = read(own, key) ?? read(DICTIONARIES.de, key) ?? key;
    if (typeof value !== "string" || !vars) return value;
    return value.replace(/\{(\w+)\}/g, (match, name) => (vars[name] ?? match));
  };
};
