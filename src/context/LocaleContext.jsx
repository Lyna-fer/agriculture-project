import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "agric-language";

const LocaleContext = createContext(null);

const SUPPORTED_LANGUAGES = ["en", "fr"];

const normalizeLanguage = (value) => {
  if (typeof value !== "string") return "en";
  const lowered = value.toLowerCase();
  return lowered.startsWith("fr") ? "fr" : "en";
};

const getInitialLanguage = () => {
  if (typeof window === "undefined") return "en";

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
    return saved;
  }

  return normalizeLanguage(window.navigator.language);
};

export function LocaleProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;

    const titles = {
      en: "SolGuide - Soil Sampling Decision Platform",
      fr: "SolGuide - Plateforme d'aide à l'échantillonnage des sols",
    };

    const descriptions = {
      en: "Decision platform for soil sampling, crop guidance, and satellite monitoring in Algeria.",
      fr: "Plateforme d'aide à l'échantillonnage des sols, au conseil cultural et au suivi satellite en Algérie.",
    };

    document.title = titles[language] || titles.en;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", descriptions[language] || descriptions.en);
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      isFrench: language === "fr",
      isEnglish: language === "en",
      setLanguage: (nextLanguage) => setLanguage(normalizeLanguage(nextLanguage)),
    }),
    [language],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
