import { createContext } from "react";

// Isolated in its own file, importing nothing but React itself — oxlint's
// react-refresh rule wants a created context kept separate from both
// components AND plain hooks/helpers for Fast Refresh to treat each file's
// boundary unambiguously (a component-only file gets state-preserving hot
// swaps; anything else gets a full remount on edit, which is what we want
// here rather than a boundary Fast Refresh gets confused about).
export const LanguageContext = createContext(null);
