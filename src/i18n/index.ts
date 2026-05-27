import { createI18n } from "vue-i18n";
import { zh } from "./zh";
import { en } from "./en";

function detectLanguage(): "zh-Hans" | "en-US" {
  const tag = (navigator?.language ?? "en").toLowerCase();
  if (tag.startsWith("zh")) return "zh-Hans";
  return "en-US";
}

// `as const` in zh/en gives them mutually-incompatible literal types, which
// breaks vue-i18n's typed-schema overload. Cast both through `any` so the
// runtime handles key resolution; we lose key-level type-checking but gain
// the freedom to keep `as const` in the message files.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const i18n = createI18n({
  legacy: false,
  locale: detectLanguage(),
  fallbackLocale: "en-US",
  messages: {
    "zh-Hans": zh as any,
    "en-US": en as any,
  },
} as any);

/** Imperative setter for runtime language switches (Settings → Language). */
export function setLanguage(value: string) {
  const lc = value === "system" ? detectLanguage() : value;
  if (typeof i18n.global.locale === "object" && "value" in i18n.global.locale) {
    (i18n.global.locale as { value: string }).value = lc;
  }
}
