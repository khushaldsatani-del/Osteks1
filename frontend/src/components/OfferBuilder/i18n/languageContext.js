import { useMemo } from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { setFormatLocale } from "../engine/format";
import { LOCALES, makeT } from "./offerT";

export { LOCALES, makeT };

// { t, language } for the offer builder, following the app's language
// switch (language "de" / "en"). Numbers and dates switch with it
// (1.234,56 € / €1,234.56).
export const useT = () => {
  const { language: appLanguage } = useTranslation();
  const language = appLanguage === "EN" ? "en" : "de";
  setFormatLocale(LOCALES[language]);
  return useMemo(() => ({ language, t: makeT(language) }), [language]);
};
