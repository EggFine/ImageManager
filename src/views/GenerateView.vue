<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useToast } from "@nuxt/ui/composables";
import { useRouter } from "vue-router";
import { useConfigStore } from "@/stores/config";
import { useCacheStore } from "@/stores/cache";
import { useHistoryStore } from "@/stores/history";
import { usePendingPromptStore } from "@/stores/pendingPrompt";
import { ApiError, generate, generateStream, type ImageResult, type PartialImage } from "@/services/apiClient";
import { computeSize } from "@/services/sizeCalc";
import { isConfigured, resolveEndpoint } from "@/services/config";
import { ENDPOINT_TYPE_LABEL } from "@/services/presets";
import {
  defaultsFromConfig,
  resolveOverrides,
  type TaskOverrides,
} from "@/composables/paramOverrides";
import ParamSourceHeader from "@/components/ParamSourceHeader.vue";
import ParamFieldsCard from "@/components/ParamFieldsCard.vue";
import SizeSelector from "@/components/SizeSelector.vue";
import ResultsView from "@/components/ResultsView.vue";
import PromptHistory from "@/components/PromptHistory.vue";
import { useEnterAnimation } from "@/composables/useEnterAnimation";

const { t } = useI18n();
const router = useRouter();
const root = ref<HTMLElement | null>(null);
useEnterAnimation(root);
const cfg = useConfigStore();
const cache = useCacheStore();
const historyStore = useHistoryStore();
const pendingPrompt = usePendingPromptStore();
const toast = useToast();

const incoming = pendingPrompt.consume("generate");
const prompt = ref(incoming ?? "");
const n = ref(1);
const busy = ref(false);
const results = ref<ImageResult[]>([]);
const partial = ref<PartialImage | null>(null);
const customOverrides = ref<TaskOverrides>(defaultsFromConfig(cfg.config));

const selectedModelId = computed(() => {
  if (
    cfg.config.selected_gen_model_id &&
    cfg.config.models.some((m) => m.id === cfg.config.selected_gen_model_id)
  ) {
    return cfg.config.selected_gen_model_id;
  }
  return cfg.config.models[0]?.id ?? "";
});

const resolved = computed(() =>
  selectedModelId.value ? resolveEndpoint(cfg.config, selectedModelId.value) : null
);
const isGoogle = computed(() => resolved.value?.endpoint.type === "google");

const paramSource = computed(() => cfg.config.selected_gen_param_source || "global");

const effectiveOverrides = computed(() =>
  resolveOverrides(cfg.config, paramSource.value, customOverrides.value)
);

const modelOptions = computed(() =>
  cfg.config.models.map((m) => {
    const ep = cfg.config.endpoints.find((e) => e.id === m.endpoint_id);
    return {
      label: ep ? `${m.label} · ${ep.name} (${ENDPOINT_TYPE_LABEL[ep.type]})` : m.label,
      value: m.id,
    };
  })
);

function handleSelectModel(id: string) {
  void cfg.update({ selected_gen_model_id: id });
}

function handleSourceChange(next: string) {
  if (next === "custom") {
    customOverrides.value = resolveOverrides(cfg.config, paramSource.value, customOverrides.value);
  }
  void cfg.update({ selected_gen_param_source: next });
}

function handleSizeChange(next: { aspectRatio: string; resolution: string; advanced: boolean; advancedText: string }) {
  if (paramSource.value === "global") {
    void cfg.update({
      default_aspect_ratio: next.aspectRatio,
      default_resolution: next.resolution,
      advanced_size_mode: next.advanced,
      default_size: next.advancedText,
    });
  } else if (paramSource.value === "custom") {
    customOverrides.value = {
      ...customOverrides.value,
      aspect_ratio: next.aspectRatio,
      resolution: next.resolution,
      advanced_size_mode: next.advanced,
      size: next.advancedText,
    };
  } else {
    void cfg.updatePreset(paramSource.value, {
      aspect_ratio: next.aspectRatio,
      resolution: next.resolution,
      advanced_size_mode: next.advanced,
      size: next.advancedText,
    });
  }
}

async function submit() {
  if (!isConfigured(cfg.config) || !resolved.value) {
    toast.add({
      title: t("dialog.missingKeyTitle"),
      description: t("dialog.missingKeyBody"),
      color: "warning",
    });
    return;
  }
  const p = prompt.value.trim();
  if (!p) {
    toast.add({
      title: t("dialog.missingPromptTitle"),
      description: t("dialog.missingPromptBody"),
      color: "warning",
    });
    return;
  }

  busy.value = true;
  results.value = [];
  partial.value = null;
  cfg.setStatus(t("status.generating"));
  historyStore.add(p, "generate");

  const overrides = resolveOverrides(cfg.config, paramSource.value, customOverrides.value);
  const size = overrides.advanced_size_mode
    ? overrides.size
    : computeSize(overrides.aspect_ratio, overrides.resolution);
  const effectiveCfg = { ...cfg.config, ...overrides };

  try {
    const useStream = cfg.config.stream && n.value === 1;
    const imgs = useStream
      ? await generateStream(
          resolved.value.endpoint,
          resolved.value.model.model_id,
          effectiveCfg,
          p,
          size,
          n.value,
          (pi) => (partial.value = pi)
        )
      : await generate(
          resolved.value.endpoint,
          resolved.value.model.model_id,
          effectiveCfg,
          p,
          size,
          n.value
        );
    results.value = imgs;
    partial.value = null;
    cfg.setStatus(t("status.success", { count: imgs.length }));

    // Cache the batch and surface a toast with a deep link to the detail
    // page — without this the user has no obvious way to find the images
    // again after navigating off the Generate page.
    if (cfg.config.auto_cache && imgs.length > 0) {
      const entry = await cache.add({
        page: "generate",
        prompt: p,
        model: resolved.value.model.model_id,
        size,
        results: imgs.map((r) => r.bytes),
        outputFormat: effectiveCfg.output_format,
      });
      toast.add({
        title: t("status.success", { count: imgs.length }),
        description: t("dialog.savedToHistory"),
        color: "success",
        icon: "i-lucide-check",
        actions: entry
          ? [
              {
                label: t("dialog.viewDetail"),
                color: "primary",
                variant: "link",
                onClick: () => {
                  void router.push(`/history/${entry.id}`);
                },
              },
            ]
          : undefined,
      });
    }
  } catch (e) {
    const title =
      e instanceof ApiError ? t("dialog.requestFailedTitle") : t("dialog.exceptionTitle");
    toast.add({
      title,
      description: e instanceof Error ? e.message : String(e),
      color: "error",
    });
    cfg.setStatus("");
  } finally {
    busy.value = false;
  }
}

function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !busy.value) {
    e.preventDefault();
    void submit();
  }
}

onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div ref="root">
    <header v-anim class="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-highlighted">{{ t("gen.title") }}</h1>
        <p class="text-sm text-muted mt-1">{{ t("gen.desc") }}</p>
      </div>
      <UButton
        variant="link"
        size="xs"
        color="primary"
        icon="i-lucide-clock"
        trailing-icon="i-lucide-arrow-right"
        to="/history"
        class="shrink-0"
      >
        {{ t("gen.viewHistory") }}
      </UButton>
    </header>

    <div
      class="grid gap-4 md:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)]"
    >
      <!-- Left: form -->
      <div v-anim class="flex flex-col gap-3 md:gap-4 lg:gap-5">
        <UCard>
          <template #header>
            <h3 class="text-sm font-medium text-toned uppercase tracking-wider">
              {{ t("gen.modelSelect") }}
            </h3>
          </template>
          <UAlert
            v-if="cfg.config.models.length === 0"
            color="warning"
            variant="soft"
            :title="t('gen.noModels')"
          />
          <USelect
            v-else
            :model-value="selectedModelId"
            :items="modelOptions"
            class="w-full"
            @update:model-value="handleSelectModel"
          />
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium text-toned uppercase tracking-wider">
                {{ t("cardLabel.prompt") }}
              </h3>
              <div class="flex items-center gap-2">
                <PromptHistory page="generate" @pick="prompt = $event" />
                <span class="font-mono text-[10.5px] text-toned tabular-nums">
                  {{ prompt.length }}
                </span>
              </div>
            </div>
          </template>
          <UTextarea
            v-model="prompt"
            :placeholder="t('gen.promptPlaceholder')"
            :rows="6"
            autoresize
            class="w-full"
          />
        </UCard>

        <template v-if="!isGoogle">
          <ParamSourceHeader
            :cfg="cfg.config"
            :source="paramSource"
            :custom-value="customOverrides"
            @update:source="handleSourceChange"
          />

          <UCard v-if="paramSource === 'custom'">
            <template #header>
              <h3 class="text-sm font-medium text-toned uppercase tracking-wider">
                {{ t("cardLabel.dimensions") }}
              </h3>
            </template>
            <SizeSelector
              :aspect-ratio="effectiveOverrides.aspect_ratio"
              :resolution="effectiveOverrides.resolution"
              :advanced="effectiveOverrides.advanced_size_mode"
              :advanced-text="effectiveOverrides.size"
              @change="handleSizeChange"
            />
          </UCard>

          <ParamFieldsCard
            v-if="paramSource === 'custom'"
            v-model:value="customOverrides"
          />
        </template>

        <UCard v-else>
          <template #header>
            <h3 class="text-sm font-medium text-toned uppercase tracking-wider">
              {{ t("cardLabel.output") }}
            </h3>
          </template>
          <UAlert color="info" variant="soft" :title="t('gen.googleHint')" />
        </UCard>

        <UCard>
          <template #header>
            <h3 class="text-sm font-medium text-toned uppercase tracking-wider">
              {{ t("cardLabel.run") }}
            </h3>
          </template>
          <div class="flex items-end gap-4">
            <UFormField v-if="!isGoogle" :label="t('gen.n')" class="w-24">
              <UInputNumber v-model="n" :min="1" :max="10" class="w-full" />
            </UFormField>
            <div class="flex-1 min-w-0 pb-1">
              <span class="text-xs text-muted truncate block leading-relaxed">
                <template v-if="resolved">
                  {{
                    t("gen.modelHint", {
                      model: resolved.model.label,
                      stream: cfg.config.stream ? t("common.on") : t("common.off"),
                    })
                  }}
                </template>
                <template v-else>{{ t("gen.noModels") }}</template>
              </span>
            </div>
          </div>
          <UButton
            block
            size="lg"
            color="primary"
            class="mt-4"
            :loading="busy"
            :disabled="!resolved"
            icon="i-lucide-sparkles"
            @click="submit"
          >
            {{ busy ? t("status.generating") : t("gen.submit") }}
            <UKbd v-if="!busy" size="sm" class="ml-2">Ctrl ↵</UKbd>
          </UButton>
        </UCard>
      </div>

      <!-- Right: results -->
      <div v-anim class="lg:sticky lg:top-2">
        <ResultsView
          :results="results"
          :partial="partial"
          :streaming="busy && results.length === 0"
        />
      </div>
    </div>
  </div>
</template>
