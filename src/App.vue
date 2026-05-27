<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { useConfigStore } from "@/stores/config";
import { setLanguage } from "@/i18n";
import Shell from "@/components/Shell.vue";

const cfg = useConfigStore();

function applyTheme(theme: string) {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}

let mediaQuery: MediaQueryList | undefined;
function onSystemThemeChange() {
  if (cfg.config.theme === "system") applyTheme("system");
}

// Hydrate config from disk before any view mounts.
onMounted(() => {
  void cfg.init();
  mediaQuery = matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", onSystemThemeChange);
});

onUnmounted(() => {
  mediaQuery?.removeEventListener("change", onSystemThemeChange);
});

watch(
  () => cfg.config.theme,
  (theme) => applyTheme(theme),
  { immediate: true }
);

watch(
  () => cfg.config.language,
  (lang) => setLanguage(lang),
  { immediate: true }
);
</script>

<template>
  <UApp>
    <Shell />
  </UApp>
</template>
