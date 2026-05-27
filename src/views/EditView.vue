<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useConfigStore } from "@/stores/config";
import { useCacheStore } from "@/stores/cache";
import { useHistoryStore } from "@/stores/history";
import { usePendingPromptStore } from "@/stores/pendingPrompt";
import { ApiError, edit, editStream, type ImageResult, type PartialImage } from "@/services/apiClient";
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

const SUPPORTED_EXT = /\.(png|jpe?g|webp)$/i;

const { t } = useI18n();
const cfg = useConfigStore();
const cache = useCacheStore();
const historyStore = useHistoryStore();
const pendingPrompt = usePendingPromptStore();
const toast = useToast();

const incoming = pendingPrompt.consume("edit");
const imagePath = ref("");
const maskPath = ref("");
const prompt = ref(incoming ?? "");
const n = ref(1);
const busy = ref(false);
const results = ref<ImageResult[]>([]);
const partial = ref<PartialImage | null>(null);
const dragHover = ref(false);
const customOverrides = ref<TaskOverrides>(defaultsFromConfig(cfg.config));

const selectedModelId = computed(() => {
  if (
    cfg.config.selected_edit_model_id &&
    cfg.config.models.some((m) => m.id === cfg.config.selected_edit_model_id)
  ) {
    return cfg.config.selected_edit_model_id;
  }
  return cfg.config.models[0]?.id ?? "";
});

const resolved = computed(() =>
  selectedModelId.value ? resolveEndpoint(cfg.config, selectedModelId.value) : null
);
const isGoogle = computed(() => resolved.value?.endpoint.type === "google");

const paramSource = computed(() => cfg.config.selected_edit_param_source || "global");
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

const isImg2 = computed(
  () => !!resolved.value && resolved.value.model.model_id.toLowerCase().startsWith("gpt-image-2")
);
const fidelityLabel = computed(() =>
  isImg2.value ? t("edit.fidelityImg2") : t("edit.fidelityCustom", { value: cfg.config.input_fidelity })
);

function handleSelectModel(id: string) {
  void cfg.update({ selected_edit_model_id: id });
}

function handleSourceChange(next: string) {
  if (next === "custom") {
    customOverrides.value = resolveOverrides(cfg.config, paramSource.value, customOverrides.value);
  }
  void cfg.update({ selected_edit_param_source: next });
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

async function pickFile(filters: { name: string; extensions: string[] }[]): Promise<string | null> {
  const picked = await openDialog({ filters });
  if (typeof picked === "string") return picked;
  if (picked && typeof picked === "object" && "path" in picked) return (picked as { path: string }).path;
  return null;
}
const pickSource = async () => {
  const p = await pickFile([{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] }]);
  if (p) imagePath.value = p;
};
const pickMask = async () => {
  const p = await pickFile([{ name: "PNG", extensions: ["png"] }]);
  if (p) maskPath.value = p;
};

// OS-level drag-and-drop: drop a PNG/JPG/WEBP anywhere on the EditView and
// it becomes the source image.
let unlisten: (() => void) | undefined;
onMounted(async () => {
  unlisten = await getCurrentWindow().onDragDropEvent((event) => {
    const payload = event.payload as
      | { type: "enter" | "over"; paths?: string[] }
      | { type: "drop"; paths: string[] }
      | { type: "leave" };
    if (payload.type === "enter" || payload.type === "over") dragHover.value = true;
    else if (payload.type === "leave") dragHover.value = false;
    else if (payload.type === "drop") {
      dragHover.value = false;
      const path = payload.paths?.find((p) => SUPPORTED_EXT.test(p));
      if (path) imagePath.value = path;
      else if (payload.paths?.length) {
        toast.add({ title: t("dialog.invalidImageTitle"), description: t("dnd.invalidFormat"), color: "warning" });
      }
    }
  });
});
onUnmounted(() => unlisten?.());

async function submit() {
  if (!isConfigured(cfg.config) || !resolved.value) {
    toast.add({ title: t("dialog.missingKeyTitle"), description: t("dialog.missingKeyBody"), color: "warning" });
    return;
  }
  if (!imagePath.value || !(await exists(imagePath.value))) {
    toast.add({ title: t("dialog.invalidImageTitle"), description: t("dialog.invalidImageBody"), color: "warning" });
    return;
  }
  const p = prompt.value.trim();
  if (!p) {
    toast.add({ title: t("dialog.missingPromptTitle"), description: t("dialog.missingEditPromptBody"), color: "warning" });
    return;
  }
  const mask = isGoogle.value ? null : maskPath.value || null;

  busy.value = true;
  results.value = [];
  partial.value = null;
  cfg.setStatus(t("status.processing"));
  historyStore.add(p, "edit");

  const overrides = resolveOverrides(cfg.config, paramSource.value, customOverrides.value);
  const size = overrides.advanced_size_mode
    ? overrides.size
    : computeSize(overrides.aspect_ratio, overrides.resolution);
  const effectiveCfg = { ...cfg.config, ...overrides };

  try {
    const useStream = cfg.config.stream && n.value === 1;
    const imgs = useStream
      ? await editStream(
          resolved.value.endpoint,
          resolved.value.model.model_id,
          effectiveCfg,
          imagePath.value,
          mask,
          p,
          size,
          n.value,
          (pi) => (partial.value = pi)
        )
      : await edit(
          resolved.value.endpoint,
          resolved.value.model.model_id,
          effectiveCfg,
          imagePath.value,
          mask,
          p,
          size,
          n.value
        );
    results.value = imgs;
    partial.value = null;
    cfg.setStatus(t("status.success", { count: imgs.length }));

    if (cfg.config.auto_cache && imgs.length > 0) {
      void cache.add({
        page: "edit",
        prompt: p,
        model: resolved.value.model.model_id,
        size,
        results: imgs.map((r) => r.bytes),
        outputFormat: effectiveCfg.output_format,
      });
    }
  } catch (e) {
    const title = e instanceof ApiError ? t("dialog.requestFailedTitle") : t("dialog.exceptionTitle");
    toast.add({ title, description: e instanceof Error ? e.message : String(e), color: "error" });
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
  <div>
    <header class="mb-4">
      <h1 class="text-2xl font-semibold text-highlighted">{{ t("edit.title") }}</h1>
      <p class="text-sm text-muted mt-1">{{ t("edit.desc") }}</p>
    </header>

    <div
      class="relative grid gap-4 md:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)]"
    >
      <div
        v-if="dragHover"
        class="pointer-events-none absolute inset-0 z-10 rounded-md flex items-center justify-center bg-primary/15 border-2 border-dashed border-primary"
        aria-hidden
      >
        <div class="flex flex-col items-center gap-2 text-primary">
          <UIcon name="i-lucide-image-down" class="size-8" />
          <span class="italic text-base">{{ t("dnd.dropToReplaceSource") }}</span>
        </div>
      </div>

      <div class="flex flex-col gap-3 md:gap-4 lg:gap-5">
        <UCard>
          <template #header>
            <h3 class="text-sm font-medium text-toned uppercase tracking-wider">
              {{ t("edit.modelSelect") }}
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
            <h3 class="text-sm font-medium text-toned uppercase tracking-wider">
              {{ t("cardLabel.inputs") }}
            </h3>
          </template>
          <UFormField :label="t('edit.source')" class="mb-3">
            <div class="flex gap-2">
              <UInput
                v-model="imagePath"
                readonly
                :placeholder="t('common.notSelected') ?? ''"
                class="flex-1 font-mono"
              />
              <UButton icon="i-lucide-folder-open" :aria-label="t('a11y.pickImage')" @click="pickSource" />
            </div>
          </UFormField>
          <UFormField v-if="!isGoogle" :label="t('edit.mask')">
            <div class="flex gap-2">
              <UInput
                v-model="maskPath"
                readonly
                :placeholder="t('common.notSelected') ?? ''"
                class="flex-1 font-mono"
              />
              <UButton icon="i-lucide-folder-open" :aria-label="t('a11y.pickImage')" @click="pickMask" />
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                :aria-label="t('a11y.clearMask')"
                @click="maskPath = ''"
              />
            </div>
          </UFormField>
          <UAlert v-else color="info" variant="soft" class="mt-2" :title="t('edit.googleMaskHint')" />
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium text-toned uppercase tracking-wider">
                {{ t("cardLabel.prompt") }}
              </h3>
              <div class="flex items-center gap-2">
                <PromptHistory page="edit" @pick="prompt = $event" />
                <span class="font-mono text-[10.5px] text-toned tabular-nums">{{ prompt.length }}</span>
              </div>
            </div>
          </template>
          <UTextarea
            v-model="prompt"
            :placeholder="t('edit.promptPlaceholder')"
            :rows="4"
            autoresize
            class="w-full"
          />
        </UCard>

        <template v-if="!isGoogle">
          <ParamSourceHeader
            :cfg="cfg.config"
            :source="paramSource"
            :custom-value="customOverrides"
            show-fidelity
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
            show-fidelity
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
                    t("edit.modelHint", {
                      model: resolved.model.label,
                      fidelity: fidelityLabel,
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
            icon="i-lucide-wand-2"
            @click="submit"
          >
            {{ busy ? t("status.processing") : t("edit.submit") }}
            <UKbd v-if="!busy" size="sm" class="ml-2">Ctrl ↵</UKbd>
          </UButton>
        </UCard>
      </div>

      <div class="lg:sticky lg:top-2">
        <ResultsView
          :results="results"
          :partial="partial"
          :streaming="busy && results.length === 0"
        />
      </div>
    </div>
  </div>
</template>
