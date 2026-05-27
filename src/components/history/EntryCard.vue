<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { readEntryImage, type CacheEntry } from "@/services/imageCache";
import { useConfigStore } from "@/stores/config";

const props = defineProps<{ entry: CacheEntry }>();
const emit = defineEmits<{ "use-prompt": []; delete: [] }>();

const { t } = useI18n();
const cfg = useConfigStore();
const toast = useToast();

const thumbs = ref<string[]>([]);
const enlarged = ref<number | null>(null);

async function loadThumbs() {
  thumbs.value.forEach((u) => URL.revokeObjectURL(u));
  thumbs.value = [];
  const mime =
    props.entry.ext === "jpeg"
      ? "image/jpeg"
      : props.entry.ext === "webp"
        ? "image/webp"
        : "image/png";
  for (const filename of props.entry.files) {
    try {
      const bytes = await readEntryImage(filename);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
      thumbs.value = [...thumbs.value, url];
    } catch (e) {
      console.warn("Failed to load thumb", filename, e);
    }
  }
}

watch(() => props.entry.id, loadThumbs, { immediate: true });
onBeforeUnmount(() => thumbs.value.forEach((u) => URL.revokeObjectURL(u)));

const relTime = computed(() => {
  const delta = (Date.now() - props.entry.timestamp) / 1000;
  if (delta < 60) return t("historyPage.relTime.justNow");
  if (delta < 3600) return t("historyPage.relTime.minutesAgo", { n: Math.floor(delta / 60) });
  if (delta < 86400) return t("historyPage.relTime.hoursAgo", { n: Math.floor(delta / 3600) });
  if (delta < 86400 * 7) return t("historyPage.relTime.daysAgo", { n: Math.floor(delta / 86400) });
  return new Date(props.entry.timestamp).toLocaleDateString();
});

async function saveOne(idx: number) {
  const filename = props.entry.files[idx];
  const ts = new Date(props.entry.timestamp).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suggested = `image_${ts}_${String(idx + 1).padStart(2, "0")}.${props.entry.ext}`;
  let target: string | null;
  if (cfg.config.save_directory) {
    target = `${cfg.config.save_directory.replace(/\\/g, "/")}/${suggested}`;
  } else {
    target = await saveDialog({
      defaultPath: suggested,
      filters: [{ name: props.entry.ext.toUpperCase(), extensions: [props.entry.ext] }],
    });
  }
  if (!target) return;
  const bytes = await readEntryImage(filename);
  await writeFile(target, bytes);
  cfg.setStatus(t("status.savedOne", { path: target }));
  toast.add({ title: t("historyPage.saveOne"), description: target, color: "success" });
}

async function saveAll() {
  let dir = cfg.config.save_directory;
  if (!dir) {
    const picked = await openDialog({ directory: true });
    if (!picked || typeof picked !== "string") return;
    dir = picked;
  }
  const ts = new Date(props.entry.timestamp).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  let saved = 0;
  for (let i = 0; i < props.entry.files.length; i++) {
    try {
      const filename = `image_${ts}_${String(i + 1).padStart(2, "0")}.${props.entry.ext}`;
      const bytes = await readEntryImage(props.entry.files[i]);
      await writeFile(`${dir.replace(/\\/g, "/")}/${filename}`, bytes);
      saved++;
    } catch (e) {
      console.error("save failed", e);
    }
  }
  cfg.setStatus(t("status.savedMany", { saved, total: props.entry.files.length, dir }));
}

function close() {
  enlarged.value = null;
}
function prev() {
  if (enlarged.value === null) return;
  enlarged.value = enlarged.value > 0 ? enlarged.value - 1 : props.entry.files.length - 1;
}
function next() {
  if (enlarged.value === null) return;
  enlarged.value =
    enlarged.value < props.entry.files.length - 1 ? enlarged.value + 1 : 0;
}

function onKey(e: KeyboardEvent) {
  if (enlarged.value === null) return;
  if (e.key === "Escape") close();
  else if (e.key === "ArrowLeft") prev();
  else if (e.key === "ArrowRight") next();
}

watch(enlarged, (v) => {
  if (v !== null) window.addEventListener("keydown", onKey);
  else window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <UCard variant="soft">
    <div class="flex flex-col md:flex-row gap-4 md:gap-5">
      <div class="flex flex-wrap gap-2 md:w-[280px] shrink-0">
        <button
          v-for="(_, i) in entry.files"
          :key="i"
          class="relative w-[60px] h-[60px] rounded-md overflow-hidden border border-default hover:border-primary transition-colors"
          :title="`#${i + 1}`"
          @click="enlarged = i"
        >
          <img v-if="thumbs[i]" :src="thumbs[i]" alt="" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full bg-elevated animate-pulse" />
          <span
            class="absolute top-0.5 left-1 font-mono text-[9px] tabular-nums bg-inverted/70 text-inverted px-1 rounded-sm"
          >
            {{ String(i + 1).padStart(2, "0") }}
          </span>
        </button>
      </div>

      <div class="flex-1 min-w-0 flex flex-col gap-3">
        <p class="text-sm text-highlighted leading-relaxed line-clamp-3">{{ entry.prompt }}</p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-toned font-mono">
          <span class="uppercase text-primary">{{ entry.page }}</span>
          <span>·</span>
          <span>{{ entry.model }}</span>
          <span>·</span>
          <span>{{ entry.size }}</span>
          <span>·</span>
          <span>{{ relTime }}</span>
          <span>·</span>
          <span class="uppercase">{{ entry.ext }}</span>
        </div>
        <div class="flex flex-wrap gap-2 mt-1">
          <UButton
            size="sm"
            variant="outline"
            icon="i-lucide-corner-down-left"
            @click="emit('use-prompt')"
          >
            {{ t("historyPage.usePrompt") }}
          </UButton>
          <UButton size="sm" variant="outline" icon="i-lucide-download-cloud" @click="saveAll">
            {{ t("historyPage.saveBatch") }}
          </UButton>
          <UButton
            size="sm"
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            :aria-label="t('historyPage.deleteOne')"
            :title="t('historyPage.deleteOne')"
            @click="emit('delete')"
          />
        </div>
      </div>
    </div>
  </UCard>

  <UModal :open="enlarged !== null" :ui="{ content: 'max-w-[90vw]' }" @update:open="enlarged = null">
    <template #content>
      <div class="relative bg-inverted/85 flex items-center justify-center p-8 min-h-[60vh]">
        <img
          v-if="enlarged !== null && thumbs[enlarged]"
          :src="thumbs[enlarged]"
          alt=""
          class="max-w-full max-h-[80vh] object-contain rounded shadow-2xl select-none"
        />
        <div
          class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-default border border-default rounded-full px-4 py-2"
        >
          <span class="font-mono text-xs tabular-nums text-muted">
            {{ enlarged !== null ? String(enlarged + 1).padStart(2, "0") : "" }} /
            {{ String(entry.files.length).padStart(2, "0") }}
          </span>
          <span class="w-px h-3 bg-default" />
          <UButton
            size="sm"
            variant="ghost"
            icon="i-lucide-download"
            :disabled="enlarged === null"
            @click="enlarged !== null && saveOne(enlarged)"
          >
            {{ t("historyPage.saveOne") }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
