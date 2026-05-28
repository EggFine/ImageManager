<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useToast } from "@nuxt/ui/composables";
import { useRoute, useRouter } from "vue-router";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { useCacheStore } from "@/stores/cache";
import { useConfigStore } from "@/stores/config";
import { usePendingPromptStore } from "@/stores/pendingPrompt";
import { readEntryImage } from "@/services/imageCache";
import ImageLightbox from "@/components/ImageLightbox.vue";
import { useEnterAnimation } from "@/composables/useEnterAnimation";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const cache = useCacheStore();
const cfg = useConfigStore();
const pendingPrompt = usePendingPromptStore();
const toast = useToast();
const root = ref<HTMLElement | null>(null);
useEnterAnimation(root);

onMounted(() => void cache.init());

const entry = computed(() =>
  cache.entries.find((e) => e.id === route.params.id)
);

const imageUrls = ref<string[]>([]);
const enlarged = ref<number | null>(null);

watch(
  entry,
  async (e) => {
    imageUrls.value.forEach((u) => URL.revokeObjectURL(u));
    imageUrls.value = [];
    if (!e) return;
    const mime =
      e.ext === "jpeg" ? "image/jpeg" : e.ext === "webp" ? "image/webp" : "image/png";
    for (const f of e.files) {
      try {
        const bytes = await readEntryImage(f);
        const url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: mime })
        );
        imageUrls.value = [...imageUrls.value, url];
      } catch (err) {
        console.warn("Failed to load image", err);
      }
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  imageUrls.value.forEach((u) => URL.revokeObjectURL(u));
});

const relTime = computed(() => {
  if (!entry.value) return "";
  const delta = (Date.now() - entry.value.timestamp) / 1000;
  if (delta < 60) return t("historyPage.relTime.justNow");
  if (delta < 3600) return t("historyPage.relTime.minutesAgo", { n: Math.floor(delta / 60) });
  if (delta < 86400) return t("historyPage.relTime.hoursAgo", { n: Math.floor(delta / 3600) });
  if (delta < 86400 * 7) return t("historyPage.relTime.daysAgo", { n: Math.floor(delta / 86400) });
  return new Date(entry.value.timestamp).toLocaleString();
});

function usePrompt() {
  if (!entry.value) return;
  pendingPrompt.set(entry.value.prompt, entry.value.page);
  void router.push("/create");
}

async function saveOne(idx: number) {
  if (!entry.value) return;
  const e = entry.value;
  const filename = e.files[idx];
  const ts = new Date(e.timestamp).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suggested = `image_${ts}_${String(idx + 1).padStart(2, "0")}.${e.ext}`;
  let target: string | null;
  if (cfg.config.save_directory) {
    target = `${cfg.config.save_directory.replace(/\\/g, "/")}/${suggested}`;
  } else {
    target = await saveDialog({
      defaultPath: suggested,
      filters: [{ name: e.ext.toUpperCase(), extensions: [e.ext] }],
    });
  }
  if (!target) return;
  const bytes = await readEntryImage(filename);
  await writeFile(target, bytes);
  cfg.setStatus(t("status.savedOne", { path: target }));
  toast.add({ title: t("historyPage.saveOne"), description: target, color: "success" });
}

async function saveAll() {
  if (!entry.value) return;
  let dir = cfg.config.save_directory;
  if (!dir) {
    const picked = await openDialog({ directory: true });
    if (!picked || typeof picked !== "string") return;
    dir = picked;
  }
  const e = entry.value;
  const ts = new Date(e.timestamp).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  let saved = 0;
  for (let i = 0; i < e.files.length; i++) {
    try {
      const filename = `image_${ts}_${String(i + 1).padStart(2, "0")}.${e.ext}`;
      const bytes = await readEntryImage(e.files[i]);
      await writeFile(`${dir.replace(/\\/g, "/")}/${filename}`, bytes);
      saved++;
    } catch (err) {
      console.error("save failed", err);
    }
  }
  cfg.setStatus(t("status.savedMany", { saved, total: e.files.length, dir }));
}

async function handleDelete() {
  if (!entry.value) return;
  if (!confirm(t("historyPage.confirmDeleteOne"))) return;
  await cache.remove(entry.value.id);
  void router.push("/history");
}

function prevImage() {
  if (enlarged.value === null || !entry.value) return;
  enlarged.value =
    enlarged.value > 0 ? enlarged.value - 1 : entry.value.files.length - 1;
}
function nextImage() {
  if (enlarged.value === null || !entry.value) return;
  enlarged.value =
    enlarged.value < entry.value.files.length - 1 ? enlarged.value + 1 : 0;
}

// Bridge between the parent's `enlarged: number | null` state and the
// lightbox's boolean `open` + string `src`. The lightbox owns Esc/arrow
// keys internally (and emits @prev/@next for us to wire up).
const lightboxOpen = computed({
  get: () => enlarged.value !== null,
  set: (v) => {
    if (!v) enlarged.value = null;
  },
});
const lightboxSrc = computed(() =>
  enlarged.value !== null ? imageUrls.value[enlarged.value] : null
);
</script>

<template>
  <div v-if="!entry" class="flex flex-col items-center gap-3 py-16 text-toned">
    <UIcon name="i-lucide-search-x" class="size-8" />
    <p class="text-sm text-muted">{{ t("historyPage.notFound") }}</p>
    <UButton variant="link" color="primary" trailing-icon="i-lucide-arrow-right" to="/history">
      {{ t("historyPage.backToList") }}
    </UButton>
  </div>

  <div v-else ref="root" class="flex flex-col gap-5">
    <UButton
      v-anim
      variant="ghost"
      color="neutral"
      icon="i-lucide-arrow-left"
      class="self-start"
      to="/history"
    >
      {{ t("historyPage.backToList") }}
    </UButton>

    <UCard v-anim>
      <p class="text-base text-highlighted leading-relaxed whitespace-pre-wrap">
        {{ entry.prompt }}
      </p>
      <USeparator class="my-3" />
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
        <span>·</span>
        <span>{{ entry.files.length }} img</span>
      </div>
      <div class="flex flex-wrap gap-2 mt-4">
        <UButton variant="outline" icon="i-lucide-corner-down-left" @click="usePrompt">
          {{ t("historyPage.usePrompt") }}
        </UButton>
        <UButton variant="outline" icon="i-lucide-download-cloud" @click="saveAll">
          {{ t("historyPage.saveBatch") }}
        </UButton>
        <UButton variant="ghost" color="error" icon="i-lucide-trash-2" @click="handleDelete">
          {{ t("historyPage.deleteOne") }}
        </UButton>
      </div>
    </UCard>

    <div v-anim class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="(url, i) in imageUrls"
        :key="i"
        class="relative rounded-md overflow-hidden bg-elevated/40 border border-default group cursor-pointer transition hover:border-primary/50"
        @click="enlarged = i"
      >
        <img :src="url" alt="" class="w-full h-auto object-contain" />
        <div
          class="absolute top-2 left-2 bg-inverted/70 text-inverted text-[10px] font-mono px-1.5 py-0.5 rounded tabular-nums"
        >
          {{ String(i + 1).padStart(2, "0") }} / {{ String(entry.files.length).padStart(2, "0") }}
        </div>
        <UButton
          icon="i-lucide-download"
          variant="solid"
          color="primary"
          size="xs"
          class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          :aria-label="t('historyPage.saveOne')"
          :title="t('historyPage.saveOne')"
          @click.stop="saveOne(i)"
        />
      </div>
    </div>

    <ImageLightbox
      v-model:open="lightboxOpen"
      :src="lightboxSrc"
      @prev="prevImage"
      @next="nextImage"
    >
      <template #toolbar-extra>
        <USeparator orientation="vertical" class="h-4 mx-1" />
        <UButton
          icon="i-lucide-chevron-left"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="prevImage"
        />
        <span class="font-mono text-xs tabular-nums text-muted px-1.5 select-none">
          {{ enlarged !== null ? String(enlarged + 1).padStart(2, "0") : "" }} /
          {{ String(entry.files.length).padStart(2, "0") }}
        </span>
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="nextImage"
        />
        <USeparator orientation="vertical" class="h-4 mx-1" />
        <UButton
          icon="i-lucide-download"
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="enlarged === null"
          :aria-label="t('historyPage.saveOne')"
          :title="t('historyPage.saveOne')"
          @click="enlarged !== null && saveOne(enlarged)"
        />
      </template>
    </ImageLightbox>
  </div>
</template>
