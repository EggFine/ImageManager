<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useToast } from "@nuxt/ui/composables";
import { testConnection } from "@/services/apiClient";
import type { ConnectionTestResult } from "@/services/apiClientTypes";
import {
  DEFAULT_BASE_URL,
  ENDPOINT_TYPE_LABEL,
  PRESET_MODELS,
  type EndpointType,
} from "@/services/presets";
import { useConfigStore } from "@/stores/config";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ complete: [] }>();

const { t } = useI18n();
const toast = useToast();
const cfg = useConfigStore();

const isOpen = ref(props.open);
watch(() => props.open, (v) => (isOpen.value = v));
watch(isOpen, (v) => {
  // The modal is now dismissible via backdrop / Escape; any close path
  // bubbles up here so the parent can clear `manualOpen`.
  if (!v && props.open) emit("complete");
});

const step = ref<1 | 2>(1);

// Step 1 state
const epType = ref<EndpointType>("openai");
const epName = ref("OpenAI");
const epBaseUrl = ref(DEFAULT_BASE_URL.openai);
const epApiKey = ref("");
const urlDirty = ref(false);
const nameDirty = ref(false);
const testing = ref(false);
const testResult = ref<ConnectionTestResult | null>(null);
const endpointId = ref<string>("");

// Step 2 state
const modelMode = ref<"preset" | "custom">("preset");
const presetIdx = ref(0);
const customModelId = ref("");
const modelLabel = ref("");
const labelDirty = ref(false);
const finishing = ref(false);

// Auto-fill name + URL when type switches (unless user edited)
watch(epType, () => {
  if (!urlDirty.value) epBaseUrl.value = DEFAULT_BASE_URL[epType.value];
  if (!nameDirty.value) epName.value = ENDPOINT_TYPE_LABEL[epType.value];
  testResult.value = null;
  presetIdx.value = 0;
});

const presets = computed(() => PRESET_MODELS[epType.value]);

// Sync the model label with the chosen preset / custom name unless user
// typed their own label.
watch([modelMode, presetIdx, customModelId], () => {
  if (labelDirty.value) return;
  if (modelMode.value === "preset" && presets.value[presetIdx.value]) {
    modelLabel.value = presets.value[presetIdx.value].label;
  } else if (modelMode.value === "custom") {
    modelLabel.value = customModelId.value || "";
  }
});

const presetOptions = computed(() =>
  presets.value.map((p, i) => ({
    label: p.label,
    value: String(i),
    description: p.model_id,
  }))
);

const presetIdxStr = computed({
  get: () => String(presetIdx.value),
  set: (v: string) => (presetIdx.value = Number(v)),
});

const transientEndpoint = computed(() => ({
  id: "draft",
  name: epName.value.trim() || ENDPOINT_TYPE_LABEL[epType.value],
  type: epType.value,
  base_url: epBaseUrl.value.trim(),
  api_key: epApiKey.value.trim(),
}));

async function handleTest() {
  if (!epBaseUrl.value.trim() || !epApiKey.value.trim()) {
    toast.add({ title: t("onboarding.needsBoth"), color: "warning" });
    return;
  }
  testing.value = true;
  testResult.value = null;
  testResult.value = await testConnection(transientEndpoint.value);
  testing.value = false;
}

async function handleNext() {
  if (!epApiKey.value.trim()) {
    toast.add({ title: t("onboarding.needsBoth"), color: "warning" });
    return;
  }
  if (endpointId.value) {
    await cfg.updateEndpoint(endpointId.value, {
      name: transientEndpoint.value.name,
      type: transientEndpoint.value.type,
      base_url: transientEndpoint.value.base_url,
      api_key: transientEndpoint.value.api_key,
    });
  } else {
    endpointId.value = await cfg.addEndpoint({
      name: transientEndpoint.value.name,
      type: transientEndpoint.value.type,
      base_url: transientEndpoint.value.base_url,
      api_key: transientEndpoint.value.api_key,
    });
  }
  step.value = 2;
}

function handleBack() {
  step.value = 1;
}

async function handleSkip() {
  if (endpointId.value) {
    await cfg.removeEndpoint(endpointId.value);
    endpointId.value = "";
  }
  emit("complete");
}

async function handleFinish() {
  const modelId =
    modelMode.value === "preset"
      ? presets.value[presetIdx.value]?.model_id
      : customModelId.value.trim();
  if (!modelId) {
    toast.add({ title: t("onboarding.modelRequired"), color: "warning" });
    return;
  }
  if (!endpointId.value) {
    toast.add({ title: t("onboarding.endpointMissing"), color: "error" });
    step.value = 1;
    return;
  }
  finishing.value = true;
  await cfg.addModel({
    endpoint_id: endpointId.value,
    model_id: modelId,
    label: modelLabel.value.trim() || modelId,
    is_custom: modelMode.value === "custom",
  });
  finishing.value = false;
  emit("complete");
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :ui="{ content: 'max-w-[600px]' }"
  >
    <template #content>
      <div class="p-6 md:p-8 flex flex-col gap-4">
        <!-- Masthead -->
        <div class="flex items-center justify-between gap-3">
          <span class="text-[10.5px] font-mono uppercase tracking-[0.16em] text-toned">
            {{ t("onboarding.eyebrow") }}
          </span>
          <span class="text-[10.5px] font-mono tracking-wider text-toned">
            {{ t("onboarding.stepLabel", { current: step, total: 2 }) }}
          </span>
        </div>

        <h2 class="font-semibold leading-tight tracking-tight">
          <span class="block text-3xl text-highlighted">
            {{ step === 1 ? t("onboarding.step1Title") : t("onboarding.step2Title") }}
          </span>
          <span class="block text-xl text-muted italic">
            {{ step === 1 ? t("onboarding.step1Subtitle") : t("onboarding.step2Subtitle") }}
          </span>
        </h2>
        <p class="text-sm text-muted leading-relaxed">
          {{ step === 1 ? t("onboarding.step1Body") : t("onboarding.step2Body") }}
        </p>

        <!-- Step 1: endpoint form -->
        <div v-if="step === 1" class="flex flex-col gap-4">
          <div class="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-3">
            <UFormField :label="t('endpoint.name')">
              <UInput
                v-model="epName"
                placeholder="OpenAI"
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
              :loading="testing"
              :disabled="!epBaseUrl.trim() || !epApiKey.trim()"
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
        </div>

        <!-- Step 2: model form -->
        <div v-if="step === 2" class="flex flex-col gap-4">
          <div class="flex items-center gap-2 text-sm text-muted">
            <span class="text-[10.5px] font-mono uppercase tracking-wider text-toned">
              {{ t("model.endpoint") }}
            </span>
            <UBadge color="neutral" variant="subtle" size="sm">
              {{ epName }} · {{ ENDPOINT_TYPE_LABEL[epType] }}
            </UBadge>
          </div>

          <UFormField :label="t('model.modelId')">
            <USelect
              v-if="modelMode === 'preset'"
              v-model="presetIdxStr"
              :items="presetOptions"
              class="w-full"
            />
            <UInput
              v-else
              v-model="customModelId"
              :placeholder="t('model.customPlaceholder')"
              class="w-full font-mono"
            />
          </UFormField>

          <UFormField :label="t('model.customToggle')" :description="t('model.customHint')">
            <div class="flex items-center gap-3 h-9">
              <USwitch
                v-model="modelMode"
                :true-value="'custom'"
                :false-value="'preset'"
              />
              <span class="text-sm text-muted">
                {{ modelMode === "custom" ? t("model.customOn") : t("model.customOff") }}
              </span>
            </div>
          </UFormField>

          <UFormField :label="t('model.label')" :description="t('model.labelHint')">
            <UInput
              v-model="modelLabel"
              :placeholder="t('model.labelPlaceholder')"
              class="w-full"
              @update:model-value="labelDirty = true"
            />
          </UFormField>
        </div>

        <!-- Actions -->
        <USeparator class="mt-2" />
        <div class="flex items-center justify-between gap-3">
          <UButton
            v-if="step === 1"
            variant="ghost"
            color="neutral"
            @click="handleSkip"
          >
            {{ t("onboarding.skip") }}
          </UButton>
          <UButton
            v-else
            variant="ghost"
            color="neutral"
            icon="i-lucide-arrow-left"
            @click="handleBack"
          >
            {{ t("onboarding.back") }}
          </UButton>

          <UButton
            v-if="step === 1"
            color="primary"
            trailing-icon="i-lucide-arrow-right"
            :disabled="testing || !epApiKey.trim()"
            @click="handleNext"
          >
            {{ t("onboarding.next") }}
          </UButton>
          <UButton
            v-else
            color="primary"
            trailing-icon="i-lucide-arrow-right"
            :loading="finishing"
            @click="handleFinish"
          >
            {{ t("onboarding.finish") }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
