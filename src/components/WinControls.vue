<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getCurrentWindow } from "@tauri-apps/api/window";

const { t } = useI18n();
const appWindow = getCurrentWindow();

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
</script>

<template>
  <div class="flex items-center gap-0.5">
    <UButton
      square
      variant="ghost"
      color="neutral"
      size="xs"
      icon="i-lucide-minus"
      :aria-label="t('titlebar.minimize')"
      :title="t('titlebar.minimize')"
      @click="appWindow.minimize()"
    />
    <UButton
      square
      variant="ghost"
      color="neutral"
      size="xs"
      :icon="isMax ? 'i-lucide-copy' : 'i-lucide-square'"
      :aria-label="isMax ? t('titlebar.restore') : t('titlebar.maximize')"
      :title="isMax ? t('titlebar.restore') : t('titlebar.maximize')"
      @click="appWindow.toggleMaximize()"
    />
    <UButton
      square
      variant="ghost"
      color="neutral"
      size="xs"
      icon="i-lucide-x"
      :aria-label="t('titlebar.close')"
      :title="t('titlebar.close')"
      class="hover:!text-white hover:!bg-error"
      @click="appWindow.close()"
    />
  </div>
</template>
