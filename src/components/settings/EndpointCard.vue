<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useToast } from "@nuxt/ui/composables";
import { useConfigStore } from "@/stores/config";
import { testConnection } from "@/services/apiClient";
import type { ConnectionTestResult } from "@/services/apiClientTypes";
import {
  DEFAULT_BASE_URL,
  ENDPOINT_TYPE_LABEL,
  type EndpointType,
} from "@/services/presets";
import type { Endpoint } from "@/services/config";
import CollapsibleCard from "./CollapsibleCard.vue";

const props = defineProps<{ endpoint: Endpoint }>();

const { t } = useI18n();
const toast = useToast();
const cfg = useConfigStore();

const testing = ref(false);
const testResult = ref<ConnectionTestResult | null>(null);

const modelsCount = computed(
  () => cfg.config.models.filter((m) => m.endpoint_id === props.endpoint.id).length
);

function patchEp(p: Partial<Endpoint>) {
  void cfg.updateEndpoint(props.endpoint.id, p);
}

async function handleTest() {
  testing.value = true;
  testResult.value = null;
  const r = await testConnection(props.endpoint);
  testResult.value = r;
  testing.value = false;
  if (r.ok) {
    toast.add({
      title: t("settings.testOk"),
      description:
        r.modelCount !== undefined ? t("settings.testModels", { count: r.modelCount }) : r.message,
      color: "success",
    });
  } else {
    toast.add({ title: t("settings.testFail"), description: r.message, color: "error" });
  }
}

async function handleRemove() {
  const msg =
    modelsCount.value > 0
      ? t("endpoint.removeWithModelsConfirm", { name: props.endpoint.name, count: modelsCount.value })
      : t("endpoint.removeConfirm", { name: props.endpoint.name });
  if (!confirm(msg)) return;
  await cfg.removeEndpoint(props.endpoint.id);
}
</script>

<template>
  <CollapsibleCard
    :title="endpoint.name || ENDPOINT_TYPE_LABEL[endpoint.type]"
    :subtitle="`${ENDPOINT_TYPE_LABEL[endpoint.type]} · ${endpoint.base_url || '—'}`"
    :remove-label="t('endpoint.remove')"
    @remove="handleRemove"
  >
    <div class="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-3">
      <UFormField :label="t('endpoint.name')">
        <UInput
          :model-value="endpoint.name"
          :placeholder="ENDPOINT_TYPE_LABEL[endpoint.type]"
          class="w-full"
          @update:model-value="patchEp({ name: $event })"
          @blur="patchEp({ name: (($event.target as HTMLInputElement).value).trim() })"
        />
      </UFormField>
      <UFormField :label="t('endpoint.type')">
        <USelect
          :model-value="endpoint.type"
          :items="[
            { label: t('endpoint.typeOpenai'), value: 'openai' },
            { label: t('endpoint.typeGoogle'), value: 'google' },
          ]"
          class="w-full"
          @update:model-value="
            (v: string) => {
              const next = v as EndpointType;
              const wasDefault = Object.values(DEFAULT_BASE_URL).includes(endpoint.base_url);
              patchEp({
                type: next,
                base_url: wasDefault ? DEFAULT_BASE_URL[next] : endpoint.base_url,
              });
            }
          "
        />
      </UFormField>
    </div>

    <UFormField class="mt-3" :label="t('endpoint.url')">
      <UInput
        :model-value="endpoint.base_url"
        :placeholder="DEFAULT_BASE_URL[endpoint.type]"
        class="w-full font-mono"
        @update:model-value="patchEp({ base_url: $event })"
        @blur="patchEp({ base_url: (($event.target as HTMLInputElement).value).trim() })"
      />
    </UFormField>

    <UFormField class="mt-3" :label="t('endpoint.apiKey')">
      <UInput
        :model-value="endpoint.api_key"
        type="password"
        :placeholder="endpoint.type === 'openai' ? 'sk-...' : 'AIza...'"
        class="w-full font-mono"
        @update:model-value="patchEp({ api_key: $event })"
      />
    </UFormField>

    <div class="mt-3 flex items-center gap-3 flex-wrap">
      <UButton
        variant="outline"
        size="sm"
        icon="i-lucide-plug"
        :loading="testing"
        :disabled="!endpoint.api_key.trim()"
        @click="handleTest"
      >
        {{ testing ? t("settings.testing") : t("settings.testConnection") }}
      </UButton>
      <span
        v-if="testResult && !testing"
        :class="[
          'inline-flex items-center gap-1 text-xs',
          testResult.ok ? 'text-success' : 'text-error',
        ]"
      >
        <UIcon
          :name="testResult.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
          class="size-3.5"
        />
        {{
          testResult.ok
            ? testResult.modelCount !== undefined
              ? t("settings.testModels", { count: testResult.modelCount })
              : t("settings.testOk")
            : testResult.message
        }}
      </span>
      <span v-if="modelsCount > 0" class="ml-auto text-xs text-toned font-mono">
        {{ t("endpoint.modelsAttached", { count: modelsCount }) }}
      </span>
    </div>
  </CollapsibleCard>
</template>
