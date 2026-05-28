<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from "vue";
import { useConfigStore } from "@/stores/config";
import { useOnboardingStore } from "@/stores/onboarding";
import { setLanguage } from "@/i18n";
import Shell from "@/components/Shell.vue";
import Onboarding from "@/components/Onboarding.vue";

const onboarding = useOnboardingStore();
const onboardingOpen = computed(() => {
  if (!cfg.ready) return false;
  return !cfg.config.onboarding_completed || onboarding.manualOpen;
});

function handleOnboardingComplete() {
  onboarding.close();
}

const cfg = useConfigStore();

// `theme` IS the current applied state (light/dark). The picker / toggle
// write to it directly. `follow_system_theme` is an independent flag —
// when on, OS color-scheme changes are mirrored into `theme` (and turning
// it on immediately syncs to whatever the system currently is). Both
// controls remain independently usable.
function systemTheme(): "light" | "dark" {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme() {
  document.documentElement.classList.toggle("dark", cfg.config.theme === "dark");
}

let mediaQuery: MediaQueryList | undefined;
function onSystemThemeChange() {
  if (cfg.config.follow_system_theme) {
    void cfg.update({ theme: systemTheme() });
  }
}

onMounted(() => {
  void cfg.init();
  mediaQuery = matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", onSystemThemeChange);
});

onUnmounted(() => {
  mediaQuery?.removeEventListener("change", onSystemThemeChange);
});

watch(() => cfg.config.theme, applyTheme, { immediate: true });

// When the user flips `follow_system_theme` on, snap `theme` to whatever
// the OS currently reports. Subsequent OS changes are picked up by the
// matchMedia listener above. Turning it off is a no-op — `theme` stays.
watch(
  () => cfg.config.follow_system_theme,
  (follow) => {
    if (follow) void cfg.update({ theme: systemTheme() });
  }
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
    <Onboarding :open="onboardingOpen" @complete="handleOnboardingComplete" />
  </UApp>
</template>
