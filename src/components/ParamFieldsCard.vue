<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { AppConfig } from "@/services/config";
import type { TaskOverrides } from "@/composables/paramOverrides";

const props = defineProps<{
  value: TaskOverrides;
  showFidelity?: boolean;
}>();
const emit = defineEmits<{ "update:value": [v: TaskOverrides] }>();

const { t } = useI18n();

function patch(p: Partial<TaskOverrides>) {
  emit("update:value", { ...props.value, ...p });
}

const showCompression = computed(
  () => props.value.output_format === "jpeg" || props.value.output_format === "webp"
);
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-sm font-medium text-toned uppercase tracking-wider">
        {{ t("cardLabel.output") }}
      </h3>
    </template>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <UFormField :label="t('settings.quality')">
        <USelect
          :model-value="value.quality"
          :items="[
            { label: t('settings.qualityAuto'), value: 'auto' },
            { label: t('settings.qualityLow'), value: 'low' },
            { label: t('settings.qualityMedium'), value: 'medium' },
            { label: t('settings.qualityHigh'), value: 'high' },
          ]"
          class="w-full"
          @update:model-value="patch({ quality: $event as AppConfig['quality'] })"
        />
      </UFormField>

      <UFormField :label="t('settings.background')">
        <USelect
          :model-value="value.background"
          :items="[
            { label: t('settings.backgroundAuto'), value: 'auto' },
            { label: t('settings.backgroundTransparent'), value: 'transparent' },
            { label: t('settings.backgroundOpaque'), value: 'opaque' },
          ]"
          class="w-full"
          @update:model-value="patch({ background: $event as AppConfig['background'] })"
        />
      </UFormField>

      <UFormField :label="t('settings.outputFormat')">
        <USelect
          :model-value="value.output_format"
          :items="[
            { label: t('settings.outputFormatAuto'), value: 'auto' },
            { label: t('settings.outputFormatPng'), value: 'png' },
            { label: t('settings.outputFormatJpeg'), value: 'jpeg' },
            { label: t('settings.outputFormatWebp'), value: 'webp' },
          ]"
          class="w-full"
          @update:model-value="patch({ output_format: $event as AppConfig['output_format'] })"
        />
      </UFormField>

      <UFormField v-if="showCompression" :label="t('settings.outputCompression')">
        <UInputNumber
          :model-value="value.output_compression"
          :min="0"
          :max="100"
          class="w-full"
          @update:model-value="patch({ output_compression: $event })"
        />
      </UFormField>

      <UFormField
        v-if="showFidelity"
        :class="showCompression ? 'md:col-span-2' : ''"
        :label="t('settings.fidelity')"
      >
        <USelect
          :model-value="value.input_fidelity"
          :items="[
            { label: t('settings.fidAuto'), value: 'auto' },
            { label: t('settings.fidHigh'), value: 'high' },
            { label: t('settings.fidLow'), value: 'low' },
          ]"
          class="w-full"
          @update:model-value="patch({ input_fidelity: $event as AppConfig['input_fidelity'] })"
        />
      </UFormField>
    </div>
  </UCard>
</template>
