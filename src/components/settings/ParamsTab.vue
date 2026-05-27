<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useConfigStore } from "@/stores/config";
import type { AppConfig } from "@/services/config";
import PresetCard from "./PresetCard.vue";
import SizeSelector from "@/components/SizeSelector.vue";

const { t } = useI18n();
const cfg = useConfigStore();

const subTab = ref<"defaults" | "presets">("defaults");

function patch(p: Partial<AppConfig>) {
  void cfg.update(p);
}

async function handleAddPreset() {
  const idx = cfg.config.param_presets.length + 1;
  await cfg.addPreset({
    name: t("preset.defaultName", { n: idx }),
    aspect_ratio: cfg.config.default_aspect_ratio,
    resolution: cfg.config.default_resolution,
    advanced_size_mode: cfg.config.advanced_size_mode,
    size: cfg.config.default_size,
    quality: cfg.config.quality,
    output_format: cfg.config.output_format,
    output_compression: cfg.config.output_compression,
    background: cfg.config.background,
    input_fidelity: cfg.config.input_fidelity,
  });
}

const compressionShown = computed(
  () => cfg.config.output_format === "jpeg" || cfg.config.output_format === "webp"
);
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- Segmented sub-tabs -->
    <div
      class="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-elevated/50 border border-default self-start"
    >
      <button
        type="button"
        :class="[
          'inline-flex items-center h-7 px-3 rounded-sm text-sm font-medium transition-colors',
          subTab === 'defaults' ? 'bg-default text-highlighted shadow-sm' : 'text-muted hover:text-highlighted',
        ]"
        :aria-pressed="subTab === 'defaults'"
        @click="subTab = 'defaults'"
      >
        {{ t("params.subTab.defaults") }}
      </button>
      <button
        type="button"
        :class="[
          'inline-flex items-center h-7 px-3 rounded-sm text-sm font-medium transition-colors',
          subTab === 'presets' ? 'bg-default text-highlighted shadow-sm' : 'text-muted hover:text-highlighted',
        ]"
        :aria-pressed="subTab === 'presets'"
        @click="subTab = 'presets'"
      >
        {{ t("params.subTab.presets") }}
      </button>
    </div>

    <!-- Presets sub-tab -->
    <UCard v-if="subTab === 'presets'">
      <template #header>
        <h3 class="font-semibold">{{ t("preset.title") }}</h3>
      </template>
      <p class="text-xs text-muted mb-3">{{ t("preset.intro") }}</p>

      <div
        v-if="cfg.config.param_presets.length === 0"
        class="flex flex-col items-center justify-center gap-3 py-6"
      >
        <span class="text-sm text-muted">{{ t("preset.empty") }}</span>
        <UButton color="primary" icon="i-lucide-plus" @click="handleAddPreset">
          {{ t("preset.add") }}
        </UButton>
      </div>

      <div v-else class="flex flex-col gap-3">
        <PresetCard v-for="p in cfg.config.param_presets" :key="p.id" :preset="p" />
        <div>
          <UButton variant="outline" color="neutral" icon="i-lucide-plus" @click="handleAddPreset">
            {{ t("preset.add") }}
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Defaults sub-tab -->
    <template v-if="subTab === 'defaults'">
      <!-- Google defaults -->
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ t("settings.section.googleDefaults") }}</h3>
        </template>
        <p class="text-xs text-muted mb-3">{{ t("settings.googleDefaultsHint") }}</p>
        <UFormField :label="t('settings.googleAspectRatio')">
          <USelect
            :model-value="cfg.config.google_aspect_ratio"
            :items="[
              { label: `1:1 — ${t('size.aspect.1to1')}`, value: '1:1' },
              { label: `4:3 — ${t('size.aspect.4to3')}`, value: '4:3' },
              { label: `3:4 — ${t('size.aspect.3to4')}`, value: '3:4' },
              { label: `16:9 — ${t('size.aspect.16to9')}`, value: '16:9' },
              { label: `9:16 — ${t('size.aspect.9to16')}`, value: '9:16' },
            ]"
            class="w-full"
            @update:model-value="patch({ google_aspect_ratio: $event as AppConfig['google_aspect_ratio'] })"
          />
        </UFormField>
      </UCard>

      <!-- OpenAI defaults -->
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ t("settings.section.openaiDefaults") }}</h3>
        </template>
        <p class="text-xs text-muted mb-3">{{ t("settings.openaiDefaultsHint") }}</p>

        <SizeSelector
          :aspect-ratio="cfg.config.default_aspect_ratio"
          :resolution="cfg.config.default_resolution"
          :advanced="cfg.config.advanced_size_mode"
          :advanced-text="cfg.config.default_size"
          @change="
            (n) =>
              patch({
                default_aspect_ratio: n.aspectRatio,
                default_resolution: n.resolution,
                advanced_size_mode: n.advanced,
                default_size: n.advancedText,
              })
          "
        />
        <p class="text-xs text-muted mt-2">{{ t("settings.sizeHint") }}</p>

        <USeparator class="my-4" />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UFormField :label="t('settings.quality')">
            <USelect
              :model-value="cfg.config.quality"
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
              :model-value="cfg.config.background"
              :items="[
                { label: t('settings.backgroundAuto'), value: 'auto' },
                { label: t('settings.backgroundTransparent'), value: 'transparent' },
                { label: t('settings.backgroundOpaque'), value: 'opaque' },
              ]"
              class="w-full"
              @update:model-value="patch({ background: $event as AppConfig['background'] })"
            />
          </UFormField>
        </div>
        <p class="text-xs text-muted mt-2">{{ t("settings.qualityHint") }}</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <UFormField :label="t('settings.outputFormat')">
            <USelect
              :model-value="cfg.config.output_format"
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
          <UFormField v-if="compressionShown" :label="t('settings.outputCompression')">
            <UInputNumber
              :model-value="cfg.config.output_compression"
              :min="0"
              :max="100"
              class="w-full"
              @update:model-value="patch({ output_compression: $event })"
            />
          </UFormField>
        </div>
        <p v-if="compressionShown" class="text-xs text-muted mt-2">
          {{ t("settings.outputCompressionHint") }}
        </p>
        <UAlert
          v-if="cfg.config.background === 'transparent' && cfg.config.output_format === 'jpeg'"
          color="warning"
          variant="soft"
          class="mt-2"
          :title="t('settings.backgroundHint')"
        />

        <USeparator class="my-4" />

        <UFormField :label="t('settings.fidelity')">
          <USelect
            :model-value="cfg.config.input_fidelity"
            :items="[
              { label: t('settings.fidAuto'), value: 'auto' },
              { label: t('settings.fidHigh'), value: 'high' },
              { label: t('settings.fidLow'), value: 'low' },
            ]"
            class="w-full"
            @update:model-value="patch({ input_fidelity: $event as AppConfig['input_fidelity'] })"
          />
        </UFormField>
        <p class="text-xs text-muted mt-2">{{ t("settings.fidelityHint") }}</p>

        <USeparator class="my-4" />

        <UFormField :label="t('settings.responseFormat')">
          <div class="flex items-center gap-3 h-9">
            <USwitch
              :model-value="cfg.config.send_response_format"
              @update:model-value="patch({ send_response_format: $event })"
            />
            <span class="text-sm text-muted">
              {{ cfg.config.send_response_format ? t("settings.rfOn") : t("settings.rfOff") }}
            </span>
          </div>
        </UFormField>
      </UCard>
    </template>
  </div>
</template>
