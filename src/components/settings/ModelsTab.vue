<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useConfigStore } from "@/stores/config";
import { PRESET_MODELS } from "@/services/presets";
import ModelCard from "./ModelCard.vue";

const { t } = useI18n();
const cfg = useConfigStore();

async function handleAdd() {
  if (cfg.config.endpoints.length === 0) return;
  const endpoint = cfg.config.endpoints[0];
  const preset = PRESET_MODELS[endpoint.type][0];
  await cfg.addModel({
    endpoint_id: endpoint.id,
    model_id: preset.model_id,
    label: preset.label,
    is_custom: false,
  });
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="font-semibold">{{ t("model.title") }}</h3>
    </template>

    <div
      v-if="cfg.config.endpoints.length === 0"
      class="flex flex-col items-center justify-center gap-2 py-6 text-center"
    >
      <span class="text-sm text-muted">{{ t("model.needEndpoint") }}</span>
      <span class="text-xs text-toned">{{ t("model.needEndpointHint") }}</span>
    </div>

    <div
      v-else-if="cfg.config.models.length === 0"
      class="flex flex-col items-center justify-center gap-3 py-6"
    >
      <span class="text-sm text-muted">{{ t("model.empty") }}</span>
      <UButton color="primary" icon="i-lucide-plus" @click="handleAdd">
        {{ t("model.add") }}
      </UButton>
    </div>

    <div v-else class="flex flex-col gap-3">
      <ModelCard v-for="m in cfg.config.models" :key="m.id" :model="m" />
      <div>
        <UButton variant="outline" color="neutral" icon="i-lucide-plus" @click="handleAdd">
          {{ t("model.add") }}
        </UButton>
      </div>
    </div>
  </UCard>
</template>
