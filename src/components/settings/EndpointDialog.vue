<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useToast } from "@nuxt/ui/composables";
import { testConnection } from "@/services/apiClient";
import type { ConnectionTestResult } from "@/services/apiClientTypes";
import {
  DEFAULT_BASE_URL,
  ENDPOINT_TYPE_LABEL,
  type EndpointType,
} from "@/services/presets";
import type { Endpoint } from "@/services/config";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  "update:open": [v: boolean];
  confirm: [draft: Omit<Endpoint, "id">];
}>();

const { t } = useI18n();
const toast = useToast();

const epType = ref<EndpointType>("openai");
const epName = ref(ENDPOINT_TYPE_LABEL.openai);
const epBaseUrl = ref(DEFAULT_BASE_URL.openai);
const epApiKey = ref("");
const urlDirty = ref(false);
const nameDirty = ref(false);
const testing = ref(false);
const testResult = ref<ConnectionTestResult | null>(null);
const creating = ref(false);

watch(
  () => props.open,
  (v) => {
    if (v) {
      epType.value = "openai";
      epName.value = ENDPOINT_TYPE_LABEL.openai;
      epBaseUrl.value = DEFAULT_BASE_URL.openai;
      epApiKey.value = "";
      urlDirty.value = false;
      nameDirty.value = false;
      testResult.value = null;
      testing.value = false;
      creating.value = false;
    }
  }
);

watch(epType, () => {
  if (!urlDirty.value) epBaseUrl.value = DEFAULT_BASE_URL[epType.value];
  if (!nameDirty.value) epName.value = ENDPOINT_TYPE_LABEL[epType.value];
  testResult.value = null;
});

async function handleTest() {
  if (!epBaseUrl.value.trim() || !epApiKey.value.trim()) {
    toast.add({ title: t("onboarding.needsBoth"), color: "warning" });
    return;
  }
  testing.value = true;
  testResult.value = null;
  testResult.value = await testConnection({
    id: "draft",
    name: epName.value.trim() || ENDPOINT_TYPE_LABEL[epType.value],
    type: epType.value,
    base_url: epBaseUrl.value.trim(),
    api_key: epApiKey.value.trim(),
  });
  testing.value = false;
}

async function handleConfirm() {
  if (!epApiKey.value.trim()) {
    toast.add({ title: t("onboarding.needsBoth"), color: "warning" });
    return;
  }
  creating.value = true;
  emit("confirm", {
    name: epName.value.trim() || ENDPOINT_TYPE_LABEL[epType.value],
    type: epType.value,
    base_url: epBaseUrl.value.trim(),
    api_key: epApiKey.value.trim(),
  });
  creating.value = false;
  emit("update:open", false);
}
</script>

<template>
  <UModal
    :open="props.open"
    :ui="{ content: 'max-w-[560px]' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="p-6 md:p-8 flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <span class="text-[10.5px] font-mono uppercase tracking-[0.16em] text-toned">
            {{ t("endpoint.addTitle") }}
          </span>
        </div>
        <h2 class="text-2xl font-semibold text-highlighted">{{ t("endpoint.addHeading") }}</h2>
        <p class="text-xs text-muted leading-relaxed">{{ t("endpoint.addBody") }}</p>

        <div class="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-3">
          <UFormField :label="t('endpoint.name')">
            <UInput
              v-model="epName"
              :placeholder="ENDPOINT_TYPE_LABEL[epType]"
              autofocus
              class="w-full"
              @update:model-value="nameDirty = true"
            />
          </UFormField>
          <UFormField :label="t('endpoint.type')">
            <USelect
              v-model="epType"
              :items="[
                { label: t('endpoint.typeOpenai'), value: 'openai' },
                { label: t('endpoint.typeGoogle'), value: 'google' },
              ]"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField :label="t('endpoint.url')" :description="t('endpoint.urlHint')">
          <UInput
            v-model="epBaseUrl"
            :placeholder="DEFAULT_BASE_URL[epType]"
            class="w-full font-mono"
            @update:model-value="urlDirty = true; testResult = null"
          />
        </UFormField>

        <UFormField :label="t('endpoint.apiKey')" :description="t('endpoint.apiKeyHint')">
          <UInput
            v-model="epApiKey"
            type="password"
            :placeholder="epType === 'openai' ? 'sk-...' : 'AIza...'"
            class="w-full font-mono"
            @update:model-value="testResult = null"
          />
        </UFormField>

        <div class="flex items-center gap-3">
          <UButton
            variant="outline"
            icon="i-lucide-plug"
            size="sm"
            :loading="testing"
            :disabled="!epBaseUrl.trim() || !epApiKey.trim() || creating"
            @click="handleTest"
          >
            {{ testing ? t("settings.testing") : t("onboarding.test") }}
          </UButton>
          <span
            v-if="testResult && !testing"
            :class="[
              'inline-flex items-center gap-1 text-sm',
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
        </div>

        <USeparator class="mt-2" />

        <div class="flex items-center justify-end gap-3">
          <UButton
            variant="ghost"
            color="neutral"
            :disabled="creating"
            @click="emit('update:open', false)"
          >
            {{ t("endpoint.cancel") }}
          </UButton>
          <UButton
            color="primary"
            :loading="creating"
            :disabled="!epApiKey.trim()"
            @click="handleConfirm"
          >
            {{ t("endpoint.create") }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
