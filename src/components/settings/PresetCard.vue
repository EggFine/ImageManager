<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useConfigStore } from "@/stores/config";
import type { ParamPreset } from "@/services/config";
import CollapsibleCard from "./CollapsibleCard.vue";
import SizeSelector from "@/components/SizeSelector.vue";

const props = defineProps<{ preset: ParamPreset }>();

const { t } = useI18n();
const cfg = useConfigStore();

function patchP(p: Partial<ParamPreset>) {
  void cfg.updatePreset(props.preset.id, p);
}

async function handleRemove() {
  if (!confirm(t("preset.removeConfirm", { name: props.preset.name }))) return;
  await cfg.removePreset(props.preset.id);
}

const compressionShown = (fmt: string) => fmt === "jpeg" || fmt === "webp";
</script>

<template>
  <CollapsibleCard
    :title="preset.name"
    :subtitle="`${preset.quality} · ${preset.output_format} · ${preset.background}`"
    :remove-label="t('preset.remove')"
    @remove="handleRemove"
  >
    <UFormField :label="t('preset.name')">
      <UInput
        :model-value="preset.name"
        :placeholder="t('preset.namePlaceholder')"
        class="w-full"
        @update:model-value="patchP({ name: $event })"
        @blur="patchP({ name: (($event.target as HTMLInputElement).value).trim() })"
      />
    </UFormField>

    <div class="mt-3">
      <SizeSelector
        :aspect-ratio="preset.aspect_ratio"
        :resolution="preset.resolution"
        :advanced="preset.advanced_size_mode"
        :advanced-text="preset.size"
        @change="
          (n) =>
            patchP({
              aspect_ratio: n.aspectRatio,
              resolution: n.resolution,
              advanced_size_mode: n.advanced,
              size: n.advancedText,
            })
        "
      />
    </div>

    <USeparator class="my-3" />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
      <UFormField :label="t('settings.quality')">
        <USelect
          :model-value="preset.quality"
          :items="[
            { label: t('settings.qualityAuto'), value: 'auto' },
            { label: t('settings.qualityLow'), value: 'low' },
            { label: t('settings.qualityMedium'), value: 'medium' },
            { label: t('settings.qualityHigh'), value: 'high' },
          ]"
          class="w-full"
          @update:model-value="patchP({ quality: $event as ParamPreset['quality'] })"
        />
      </UFormField>
      <UFormField :label="t('settings.background')">
        <USelect
          :model-value="preset.background"
          :items="[
            { label: t('settings.backgroundAuto'), value: 'auto' },
            { label: t('settings.backgroundTransparent'), value: 'transparent' },
            { label: t('settings.backgroundOpaque'), value: 'opaque' },
          ]"
          class="w-full"
          @update:model-value="patchP({ background: $event as ParamPreset['background'] })"
        />
      </UFormField>
      <UFormField :label="t('settings.outputFormat')">
        <USelect
          :model-value="preset.output_format"
          :items="[
            { label: t('settings.outputFormatAuto'), value: 'auto' },
            { label: t('settings.outputFormatPng'), value: 'png' },
            { label: t('settings.outputFormatJpeg'), value: 'jpeg' },
            { label: t('settings.outputFormatWebp'), value: 'webp' },
          ]"
          class="w-full"
          @update:model-value="patchP({ output_format: $event as ParamPreset['output_format'] })"
        />
      </UFormField>
      <UFormField v-if="compressionShown(preset.output_format)" :label="t('settings.outputCompression')">
        <UInputNumber
          :model-value="preset.output_compression"
          :min="0"
          :max="100"
          class="w-full"
          @update:model-value="patchP({ output_compression: $event })"
        />
      </UFormField>
      <UFormField :label="t('settings.fidelity')">
        <USelect
          :model-value="preset.input_fidelity"
          :items="[
            { label: t('settings.fidAuto'), value: 'auto' },
            { label: t('settings.fidHigh'), value: 'high' },
            { label: t('settings.fidLow'), value: 'low' },
          ]"
          class="w-full"
          @update:model-value="patchP({ input_fidelity: $event as ParamPreset['input_fidelity'] })"
        />
      </UFormField>
    </div>
  </CollapsibleCard>
</template>
