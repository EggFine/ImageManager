import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { zh } from "./zh";
import { en } from "./en";

export type LangTag = "zh-Hans" | "en-US";

function resolveLanguage(configLang: string): LangTag {
  if (!configLang || configLang === "system") {
    const sys = (typeof navigator !== "undefined" ? navigator.language : "") || "";
    return sys.toLowerCase().startsWith("zh") ? "zh-Hans" : "en-US";
  }
  return configLang.toLowerCase().startsWith("zh") ? "zh-Hans" : "en-US";
}

function syncHtmlLang(tag: LangTag): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = tag;
  }
}

export async function initI18n(configLang: string): Promise<void> {
  const lng = resolveLanguage(configLang);
  await i18n.use(initReactI18next).init({
    resources: {
      "zh-Hans": { translation: zh },
      "en-US": { translation: en },
    },
    lng,
    fallbackLng: "en-US",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  syncHtmlLang(lng);
}

export function setLanguage(configLang: string): void {
  const lng = resolveLanguage(configLang);
  void i18n.changeLanguage(lng);
  syncHtmlLang(lng);
}

export { i18n };
