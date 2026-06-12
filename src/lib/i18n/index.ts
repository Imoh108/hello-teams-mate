import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import pt from "./locales/pt.json";

export const SUPPORTED_LOCALES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
] as const;

let initialized = false;

export function initI18n() {
  if (initialized) return i18n;
  initialized = true;
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        es: { translation: es },
        fr: { translation: fr },
        de: { translation: de },
        pt: { translation: pt },
      },
      fallbackLng: "en",
      supportedLngs: SUPPORTED_LOCALES.map((l) => l.code),
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: "qp.locale",
      },
      react: { useSuspense: false },
    });
  return i18n;
}

// initialize eagerly on import so all components have access
initI18n();

export default i18n;
