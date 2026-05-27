<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "@tauri-apps/plugin-os";
import { useConfigStore } from "@/stores/config";

const { t } = useI18n();
const cfg = useConfigStore();
const appWindow = getCurrentWindow();

// macOS uses native traffic lights (see tauri.conf.json titleBarStyle: "Overlay")
// — hide our custom Min/Max/Close on that platform.
const IS_MACOS = platform() === "macos";

const isMax = ref(false);
let unlisten: (() => void) | undefined;

onMounted(async () => {
  isMax.value = await appWindow.isMaximized();
  unlisten = await appWindow.onResized(async () => {
    isMax.value = await appWindow.isMaximized();
  });
});

onUnmounted(() => {
  unlisten?.();
});

function cycleTheme() {
  const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
  const i = order.indexOf(cfg.config.theme);
  const next = order[(i + 1) % order.length];
  void cfg.update({ theme: next });
}

const themeIcon = computedTheme();
function computedTheme() {
  return computed(() => {
    if (cfg.config.theme === "light") return "i-lucide-sun";
    if (cfg.config.theme === "dark") return "i-lucide-moon";
    return "i-lucide-monitor";
  });
}

import { computed } from "vue";
</script>

<template>
  <div
    class="h-8 shrink-0 flex items-stretch bg-default border-b border-default select-none"
  >
    <!-- Drag region — fills available space. On macOS we pad-left for the traffic lights. -->
    <div
      data-tauri-drag-region
      :class="[
        'flex-1 min-w-0 flex items-center px-3 md:px-4 gap-2 md:gap-2.5',
        IS_MACOS && 'pl-[78px]',
      ]"
    >
      <span data-tauri-drag-region class="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      <span
        data-tauri-drag-region
        class="font-mono text-[11px] tracking-[0.12em] uppercase text-muted truncate"
      >
        {{ t("app.title") }}
      </span>
      <span data-tauri-drag-region class="hidden md:inline text-toned text-[11px]">·</span>
      <span
        data-tauri-drag-region
        class="hidden md:inline italic text-[12px] text-toned truncate"
      >
        {{ t("app.tagline") }}
      </span>
    </div>

    <UButton
      variant="ghost"
      color="neutral"
      size="xs"
      :icon="themeIcon"
      :aria-label="t('titlebar.theme', { mode: cfg.config.theme })"
      :title="t('titlebar.theme', { mode: cfg.config.theme })"
      class="rounded-none w-[46px] justify-center"
      @click="cycleTheme"
    />

    <template v-if="!IS_MACOS">
      <div class="w-px self-stretch bg-default my-1.5" />
      <div class="flex items-stretch">
        <UButton
          variant="ghost"
          color="neutral"
          size="xs"
          icon="i-lucide-minus"
          :aria-label="t('titlebar.minimize')"
          :title="t('titlebar.minimize')"
          class="rounded-none w-[46px] justify-center"
          @click="appWindow.minimize()"
        />
        <UButton
          variant="ghost"
          color="neutral"
          size="xs"
          :icon="isMax ? 'i-lucide-copy' : 'i-lucide-square'"
          :aria-label="isMax ? t('titlebar.restore') : t('titlebar.maximize')"
          :title="isMax ? t('titlebar.restore') : t('titlebar.maximize')"
          class="rounded-none w-[46px] justify-center"
          @click="appWindow.toggleMaximize()"
        />
        <UButton
          variant="ghost"
          color="error"
          size="xs"
          icon="i-lucide-x"
          :aria-label="t('titlebar.close')"
          :title="t('titlebar.close')"
          class="rounded-none w-[46px] justify-center"
          @click="appWindow.close()"
        />
      </div>
    </template>
  </div>
</template>
