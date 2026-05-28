<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useConfigStore } from "@/stores/config";
import { ENDPOINT_TYPE_LABEL, PRESET_MODELS, type EndpointType } from "@/services/presets";
import type { ModelEntry } from "@/services/config";
import CollapsibleCard from "./CollapsibleCard.vue";

const props = defineProps<{ model: ModelEntry }>();

const { t } = useI18n();
const cfg = useConfigStore();

const endpoint = computed(() =>
  cfg.config.endpoints.find((e) => e.id === props.model.endpoint_id)
);
const endpointType = computed<EndpointType>(() => endpoint.value?.type ?? "openai");
const presets = computed(() => PRESET_MODELS[endpointType.value]);
const presetMatch = computed(() =>
  presets.value.find((p) => p.model_id === props.model.model_id)
);
const effectiveCustom = computed(() => props.model.is_custom || !presetMatch.value);

function patchModel(p: Partial<ModelEntry>) {
  void cfg.updateModel(props.model.id, p);
}

async function handleRemove() {
  if (!confirm(t("model.removeConfirm", { name: props.model.label || props.model.model_id }))) return;
  await cfg.removeModel(props.model.id);
}

const endpointOptions = computed(() =>
  cfg.config.endpoints.map((e) => ({
    label: `${e.name} (${ENDPOINT_TYPE_LABEL[e.type]})`,
    value: e.id,
  }))
);
const presetOptions = computed(() =>
  presets.value.map((p) => ({ label: `${p.label}  ${p.model_id}`, value: p.model_id }))
);

function selectPreset(modelId: string) {
  const p = presets.value.find((x) => x.model_id === modelId);
  patchModel({ model_id: modelId, label: p?.label ?? modelId });
}
</script>

<template>
  <CollapsibleCard
    :title="model.label || model.model_id"
    :subtitle="`${model.model_id}${endpoint ? ` · ${endpoint.name}` : ''}`"
    :remove-label="t('model.remove')"
    @remove="handleRemove"
  >
    <div class="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-3">
      <UFormField :label="t('model.label')">
        <UInput
          :model-value="model.label"
          :placeholder="t('model.labelPlaceholder')"
          class="w-full"
          @update:model-value="patchModel({ label: $event })"
          @blur="patchModel({ label: (($event.target as HTMLInputElement).value).trim() })"
        />
      </UFormField>
      <UFormField :label="t('model.endpoint')">
        <USelect
          :model-value="model.endpoint_id"
          :items="endpointOptions"
          class="w-full"
          @update:model-value="patchModel({ endpoint_id: $event })"
        />
      </UFormField>
    </div>

    <UFormField class="mt-3" :label="t('model.modelId')">
      <UInput
        v-if="effectiveCustom"
        :model-value="model.model_id"
        :placeholder="t('model.customPlaceholder')"
        class="w-full font-mono"
        @update:model-value="patchModel({ model_id: $event })"
        @blur="patchModel({ model_id: (($event.target as HTMLInputElement).value).trim() })"
      />
      <USelect
        v-else
        :model-value="model.model_id"
        :items="presetOptions"
        class="w-full"
        @update:model-value="selectPreset($event)"
      />
    </UFormField>

    <UFormField class="mt-3" :label="t('model.customToggle')">
      <div class="flex items-center gap-3 h-9">
        <USwitch
          :model-value="effectiveCustom"
          @update:model-value="patchModel({ is_custom: $event })"
        />
        <span class="text-sm text-muted">
          {{ effectiveCustom ? t("model.customOn") : t("model.customOff") }}
        </span>
      </div>
    </UFormField>
  </CollapsibleCard>
</template>
