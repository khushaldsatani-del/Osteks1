import React, { useCallback, useMemo, useState } from "react";
import { LanguageContext } from "./context";
import { LANGUAGE_STORAGE_KEY, translate } from "./LanguageContext";

// Wraps <App/> in main.jsx. Kept in its own file (component-only export) —
// see LanguageContext.jsx's comment for why that matters here.
export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return stored === "EN" || stored === "DE" ? stored : "EN";
    } catch {
      return "EN";
    }
  });

  const setLanguage = useCallback((next) => {
    setLanguageState(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — language just won't persist
      // across a reload, the toggle itself still works for this session.
    }
  }, []);

  const t = useCallback((key, vars) => translate(language, key, vars), [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
