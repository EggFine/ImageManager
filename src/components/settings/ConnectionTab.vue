<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useConfigStore } from "@/stores/config";
import type { AppConfig, Endpoint } from "@/services/config";
import EndpointCard from "./EndpointCard.vue";
import EndpointDialog from "./EndpointDialog.vue";

const { t } = useI18n();
const cfg = useConfigStore();

const addOpen = ref(false);

function patch(p: Partial<AppConfig>) {
  void cfg.update(p);
}

async function handleCreate(draft: Omit<Endpoint, "id">) {
  await cfg.addEndpoint(draft);
  addOpen.value = false;
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <UCard>
      <template #header>
        <h3 class="font-semibold">{{ t("endpoint.title") }}</h3>
      </template>

      <div
        v-if="cfg.config.endpoints.length === 0"
        class="flex flex-col items-center justify-center gap-3 py-6"
      >
        <span class="text-sm text-muted">{{ t("endpoint.empty") }}</span>
        <UButton color="primary" icon="i-lucide-plus" @click="addOpen = true">
          {{ t("endpoint.add") }}
        </UButton>
      </div>

      <div v-else class="flex flex-col gap-3">
        <EndpointCard v-for="ep in cfg.config.endpoints" :key="ep.id" :endpoint="ep" />
        <div>
          <UButton variant="outline" color="neutral" icon="i-lucide-plus" @click="addOpen = true">
            {{ t("endpoint.add") }}
          </UButton>
        </div>
      </div>

      <p class="text-xs text-muted mt-3">{{ t("settings.autoSaveHint") }}</p>
    </UCard>

    <UCard>
      <template #header>
        <h3 class="font-semibold">{{ t("settings.section.behavior") }}</h3>
      </template>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UFormField :label="t('settings.timeout')">
          <UInputNumber
            :model-value="cfg.config.timeout_seconds"
            :min="10"
            :max="3600"
            class="w-full"
            @update:model-value="patch({ timeout_seconds: $event })"
          />
        </UFormField>
        <UFormField :label="t('settings.verifySsl')">
          <div class="flex items-center gap-3 h-9">
            <USwitch
              :model-value="cfg.config.verify_ssl"
              @update:model-value="patch({ verify_ssl: $event })"
            />
            <span class="text-sm text-muted">
              {{ cfg.config.verify_ssl ? t("settings.sslOn") : t("settings.sslOff") }}
            </span>
          </div>
        </UFormField>
      </div>
    </UCard>

    <EndpointDialog v-model:open="addOpen" @confirm="handleCreate" />
  </div>
</template>
