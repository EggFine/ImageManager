<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useConfigStore } from "@/stores/config";

const { t } = useI18n();
const cfg = useConfigStore();

// `cfg.config.theme` IS the current applied state — toggle just flips it.
// `follow_system_theme` is independent and isn't touched here; if it's on,
// the next OS change will re-sync.
const themeIcon = computed(() =>
  cfg.config.theme === "dark" ? "i-lucide-moon" : "i-lucide-sun"
);

function toggleTheme() {
  const next = cfg.config.theme === "dark" ? "light" : "dark";
  void cfg.update({ theme: next });
}
</script>

<template>
  <UButton
    square
    variant="ghost"
    color="neutral"
    size="xs"
    :icon="themeIcon"
    :aria-label="t('titlebar.theme', { mode: cfg.config.theme })"
    :title="t('titlebar.theme', { mode: cfg.config.theme })"
    @click="toggleTheme"
  />
</template>
