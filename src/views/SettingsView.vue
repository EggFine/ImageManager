<script setup lang="ts">
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>

<template>
  <div class="p-6">
    <h1 class="text-3xl font-semibold">{{ t("settings.title") }}</h1>
    <p class="mt-2 text-neutral-500">{{ t("settings.subtitle") }}</p>
  </div>
</template>
