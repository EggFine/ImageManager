<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { AppConfig } from "@/services/config";
import { resolveOverrides, type TaskOverrides } from "@/composables/paramOverrides";

const props = defineProps<{
  cfg: AppConfig;
  /** "global" | "custom" | preset id */
  source: string;
  customValue: TaskOverrides;
  showFidelity?: boolean;
}>();
const emit = defineEmits<{ "update:source": [v: string] }>();

const { t } = useI18n();

const effective = computed(() =>
  resolveOverrides(props.cfg, props.source, props.customValue)
);

const sourceOptions = computed(() => [
  { label: t("paramSource.global"), value: "global" },
  ...props.cfg.param_presets.map((p) => ({ label: p.name, value: p.id })),
  { label: t("paramSource.custom"), value: "custom" },
]);

const items = computed(() => {
  const sizeLabel = effective.value.advanced_size_mode
    ? effective.value.size
    : `${effective.value.aspect_ratio} · ${effective.value.resolution}`;
  const out: Array<[string, string]> = [
    [t("paramSummary.size"), sizeLabel],
    [t("paramSummary.quality"), effective.value.quality],
    [t("paramSummary.outputFormat"), effective.value.output_format],
    [t("paramSummary.background"), effective.value.background],
  ];
  if (
    effective.value.output_format === "jpeg" ||
    effective.value.output_format === "webp"
  ) {
    out.push([t("paramSummary.compression"), String(effective.value.output_compression)]);
  }
  if (props.showFidelity) {
    out.push([t("paramSummary.fidelity"), effective.value.input_fidelity]);
  }
  return out;
});
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-sm font-medium text-toned uppercase tracking-wider">
        {{ t("paramSource.label") }}
      </h3>
    </template>
    <USelect
      :model-value="source"
      :items="sourceOptions"
      class="w-full"
      @update:model-value="emit('update:source', $event)"
    />
    <div
      v-if="source !== 'custom'"
      class="@container mt-3 grid grid-cols-2 @lg:grid-cols-4 gap-x-3 gap-y-2.5"
    >
      <div
        v-for="([k, v]) in items"
        :key="k"
        class="flex flex-col min-w-0 leading-tight"
      >
        <span class="text-[10.5px] text-toned uppercase tracking-wider truncate">
          {{ k }}
        </span>
        <span class="text-xs font-mono text-highlighted truncate">{{ v }}</span>
      </div>
    </div>
  </UCard>
</template>
