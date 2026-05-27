<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ASPECT_RATIOS, RESOLUTIONS, computeSize } from "@/services/sizeCalc";

const props = defineProps<{
  aspectRatio: string;
  resolution: string;
  advanced: boolean;
  advancedText: string;
}>();
const emit = defineEmits<{
  change: [
    next: { aspectRatio: string; resolution: string; advanced: boolean; advancedText: string }
  ];
}>();

const { t } = useI18n();

const ADVANCED_PRESETS = [
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1920x1080",
  "1080x1920",
  "2560x1440",
  "3840x2160",
];

const aspectOptions = computed(() =>
  ASPECT_RATIOS.map((a) => ({ label: t(a.labelKey), value: a.tag as string }))
);
const resolutionOptions = computed(() =>
  RESOLUTIONS.map((r) => ({ label: t(r.labelKey), value: r.tag as string }))
);

const effective = computed(() => {
  if (props.advanced) return props.advancedText.trim() || "1024x1024";
  return computeSize(props.aspectRatio, props.resolution);
});

function parseDims(s: string): { w: number; h: number } {
  const m = /^(\d+)\s*[x×]\s*(\d+)/i.exec(s.trim());
  if (!m) return { w: 1, h: 1 };
  return { w: Number(m[1]), h: Number(m[2]) };
}

const previewBox = computed(() => {
  const { w, h } = parseDims(effective.value);
  const max = 28;
  const longest = Math.max(w, h);
  return {
    width: `${Math.max(8, (w / longest) * max)}px`,
    height: `${Math.max(8, (h / longest) * max)}px`,
  };
});

function setMode(next: boolean) {
  emit("change", {
    aspectRatio: props.aspectRatio,
    resolution: props.resolution,
    advanced: next,
    advancedText: props.advancedText || effective.value,
  });
}

function setAspect(v: string) {
  emit("change", {
    aspectRatio: v,
    resolution: props.resolution,
    advanced: props.advanced,
    advancedText: props.advancedText,
  });
}
function setResolution(v: string) {
  emit("change", {
    aspectRatio: props.aspectRatio,
    resolution: v,
    advanced: props.advanced,
    advancedText: props.advancedText,
  });
}
function setAdvancedText(v: string) {
  emit("change", {
    aspectRatio: props.aspectRatio,
    resolution: props.resolution,
    advanced: props.advanced,
    advancedText: v,
  });
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <span class="text-xs font-mono uppercase tracking-wider text-toned">
        {{ t("size.label") }}
      </span>
      <div
        class="inline-flex items-stretch h-7 p-0.5 rounded-md bg-elevated/50 border border-default"
        role="tablist"
        :aria-label="t('size.label')"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="!advanced"
          :class="[
            'px-3 inline-flex items-center justify-center rounded-[3px] text-[11.5px] font-medium transition-all',
            !advanced ? 'bg-default text-highlighted shadow-sm' : 'text-muted hover:text-highlighted',
          ]"
          @click="setMode(false)"
        >
          {{ t("size.modeBasic") }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="advanced"
          :class="[
            'px-3 inline-flex items-center justify-center rounded-[3px] text-[11.5px] font-medium transition-all',
            advanced ? 'bg-default text-highlighted shadow-sm' : 'text-muted hover:text-highlighted',
          ]"
          @click="setMode(true)"
        >
          {{ t("size.modeAdvanced") }}
        </button>
      </div>
    </div>

    <div v-if="!advanced" class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <UFormField :label="t('size.aspectLabel')">
        <USelect
          :model-value="aspectRatio"
          :items="aspectOptions"
          class="w-full"
          @update:model-value="setAspect"
        />
      </UFormField>
      <UFormField :label="t('size.resolutionLabel')">
        <USelect
          :model-value="resolution"
          :items="resolutionOptions"
          class="w-full"
          @update:model-value="setResolution"
        />
      </UFormField>
    </div>

    <UFormField v-else :label="t('size.pixels')">
      <USelectMenu
        :model-value="advancedText"
        :items="ADVANCED_PRESETS"
        create-item
        class="w-full font-mono"
        @update:model-value="setAdvancedText"
      />
    </UFormField>

    <div class="flex items-center gap-3 pt-1 flex-wrap">
      <span
        aria-hidden
        class="inline-flex items-center justify-center shrink-0 w-9 h-9 rounded-md bg-elevated/60"
      >
        <span
          class="block border border-primary/70 bg-primary/15 rounded-sm"
          :style="previewBox"
        />
      </span>
      <div class="flex-1 min-w-[120px] flex flex-col">
        <span class="text-xs font-mono uppercase tracking-wider text-toned">
          {{ t("size.willSend").replace(": ", "") }}
        </span>
        <span class="font-mono text-sm text-highlighted tabular-nums font-medium mt-0.5">
          {{ effective }}
        </span>
      </div>
      <span class="hidden md:inline text-xs text-toned shrink-0">
        {{ advanced ? t("size.modeAdvancedHint") : t("size.modeBasicHint") }}
      </span>
    </div>
  </div>
</template>
