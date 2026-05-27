<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { ImageResult, PartialImage } from "@/services/apiClient";
import { useConfigStore } from "@/stores/config";

const props = defineProps<{
  results: ImageResult[];
  partial: PartialImage | null;
  streaming: boolean;
}>();

const { t } = useI18n();
const cfg = useConfigStore();

const selected = ref(0);

function bytesToUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
}

const thumbUrls = computed(() => props.results.map((r) => bytesToUrl(r.bytes)));
const partialUrl = computed(() => (props.partial ? bytesToUrl(props.partial.bytes) : null));

// Revoke object URLs to avoid leaks
watch(thumbUrls, (_n, oldUrls) => {
  oldUrls?.forEach((u) => URL.revokeObjectURL(u));
});
watch(partialUrl, (_n, oldUrl) => {
  if (oldUrl) URL.revokeObjectURL(oldUrl);
});
onBeforeUnmount(() => {
  thumbUrls.value.forEach((u) => URL.revokeObjectURL(u));
  if (partialUrl.value) URL.revokeObjectURL(partialUrl.value);
});

watch(
  () => props.results.length,
  (n) => {
    if (n === 0) selected.value = 0;
    else if (selected.value >= n) selected.value = 0;
  }
);

const previewUrl = computed(() =>
  props.results.length > 0 ? thumbUrls.value[selected.value] : partialUrl.value
);

const showStream = computed(() => props.streaming && props.results.length === 0);

const statusText = computed(() => {
  if (showStream.value) {
    return props.partial
      ? t("results.partial", { idx: props.partial.index + 1 })
      : t("results.streaming");
  }
  return props.results.length > 0 ? t("results.count", { count: props.results.length }) : "";
});

async function saveOne() {
  if (props.results.length === 0) return;
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suggested = `image_${ts}.png`;
  let target: string | null = null;
  if (cfg.config.save_directory) {
    target = `${cfg.config.save_directory.replace(/\\/g, "/")}/${suggested}`;
  } else {
    target = await saveDialog({
      defaultPath: suggested,
      filters: [{ name: "PNG", extensions: ["png"] }],
    });
  }
  if (!target) return;
  await writeFile(target, props.results[selected.value].bytes);
  cfg.setStatus(t("status.savedOne", { path: target }));
}

async function saveAll() {
  if (props.results.length === 0) return;
  let dir = cfg.config.save_directory;
  if (!dir) {
    const picked = await openDialog({ directory: true });
    if (!picked || typeof picked !== "string") return;
    dir = picked;
  }
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  let saved = 0;
  for (let i = 0; i < props.results.length; i++) {
    try {
      const name = `image_${ts}_${String(i + 1).padStart(2, "0")}.png`;
      await writeFile(`${dir.replace(/\\/g, "/")}/${name}`, props.results[i].bytes);
      saved++;
    } catch (e) {
      console.error("save failed", e);
    }
  }
  cfg.setStatus(t("status.savedMany", { saved, total: props.results.length, dir }));
}
</script>

<template>
  <div class="flex flex-col gap-4 h-full">
    <div class="flex items-baseline justify-between gap-3 px-1.5">
      <div class="flex items-baseline gap-3 min-w-0">
        <span class="text-[10.5px] font-mono uppercase tracking-wider text-toned shrink-0">
          {{ t("results.label") }}
        </span>
        <span class="italic text-lg text-highlighted truncate">{{ t("results.title") }}</span>
      </div>
      <span class="font-mono text-[10.5px] tracking-wider text-toned shrink-0">
        {{ statusText }}
      </span>
    </div>

    <div
      class="relative flex-1 min-h-[260px] md:min-h-[320px] lg:min-h-[360px] rounded-md overflow-hidden border border-default bg-elevated/50"
    >
      <div class="absolute inset-0 flex items-center justify-center p-4 md:p-6 lg:p-10">
        <img
          v-if="previewUrl"
          :key="previewUrl"
          :src="previewUrl"
          alt=""
          :class="[
            'max-w-full max-h-full object-contain select-none rounded',
            showStream && 'animate-pulse',
          ]"
        />
        <div v-else-if="showStream" class="flex flex-col items-center gap-4 text-toned">
          <div class="relative w-12 h-12">
            <div class="absolute inset-0 rounded-full border-2 border-default" />
            <div
              class="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"
            />
          </div>
          <span class="italic text-sm">{{ t("results.streaming") }}</span>
        </div>
        <div v-else class="flex flex-col items-center gap-3 text-toned">
          <div class="w-14 h-14 rounded-full bg-default border border-default flex items-center justify-center">
            <UIcon name="i-lucide-image-plus" class="size-5 text-muted" />
          </div>
          <div class="text-center">
            <div class="italic text-sm text-muted">{{ t("results.empty") }}</div>
            <div class="text-[10.5px] font-mono uppercase tracking-wider text-toned mt-1.5">
              {{ t("results.emptyHint") }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="results.length > 0"
        class="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[10.5px] tracking-[0.18em] px-2.5 py-1 rounded-full bg-inverted/85 text-inverted backdrop-blur-sm"
      >
        <span class="tabular-nums">
          {{ String(selected + 1).padStart(2, "0") }} /
          {{ String(results.length).padStart(2, "0") }}
        </span>
      </div>
    </div>

    <div v-if="results.length > 0" class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      <button
        v-for="(_, i) in results"
        :key="i"
        :class="[
          'shrink-0 w-16 h-16 relative rounded-md overflow-hidden border-2 transition',
          i === selected ? 'border-primary' : 'border-default hover:border-default',
        ]"
        :aria-pressed="i === selected"
        :aria-label="t('results.selectThumb', { n: i + 1 })"
        :title="`#${i + 1}`"
        @click="selected = i"
      >
        <img :src="thumbUrls[i]" alt="" class="w-full h-full object-cover" />
        <span
          class="absolute top-0.5 left-1 font-mono text-[10px] tabular-nums px-1 rounded-sm bg-inverted/70 text-inverted"
        >
          {{ String(i + 1).padStart(2, "0") }}
        </span>
      </button>
    </div>

    <div class="flex gap-2 items-center">
      <UButton
        variant="outline"
        size="sm"
        icon="i-lucide-download"
        :disabled="results.length === 0"
        @click="saveOne"
      >
        {{ t("results.saveOne") }}
      </UButton>
      <UButton
        variant="ghost"
        size="sm"
        icon="i-lucide-download-cloud"
        :disabled="results.length === 0"
        @click="saveAll"
      >
        {{ t("results.saveAll") }}
      </UButton>
    </div>
  </div>
</template>
