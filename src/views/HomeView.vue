<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useConfigStore } from "@/stores/config";
import { useCacheStore } from "@/stores/cache";
import { usePendingPromptStore } from "@/stores/pendingPrompt";
import { isConfigured } from "@/services/config";
import { readEntryImage, statsOf, type CacheEntry } from "@/services/imageCache";
import { useAppVersion } from "@/services/version";
import { useEnterAnimation } from "@/composables/useEnterAnimation";

const { t } = useI18n();
const router = useRouter();
const cfg = useConfigStore();
const cache = useCacheStore();
const pendingPrompt = usePendingPromptStore();
const version = useAppVersion();

const root = ref<HTMLElement | null>(null);
useEnterAnimation(root);

onMounted(() => void cache.init());

const ready = computed(() => isConfigured(cfg.config));

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return t("home.greetMorning");
  if (h >= 12 && h < 18) return t("home.greetAfternoon");
  if (h >= 18 && h < 23) return t("home.greetEvening");
  return t("home.greetNight");
});

const themeLabel = computed(() => {
  if (cfg.config.follow_system_theme) return t("home.status.themeSystem");
  return cfg.config.theme === "light" ? t("home.status.themeLight") : t("home.status.themeDark");
});

const selectedModelLabel = computed(() => {
  const sel =
    cfg.config.models.find((m) => m.id === cfg.config.selected_gen_model_id) ??
    cfg.config.models[0];
  return sel?.label || sel?.model_id || "—";
});

const workflows = computed(() => [
  {
    icon: "i-lucide-images",
    title: t("nav.generate"),
    desc: t("gen.desc"),
    to: "/generate",
  },
  {
    icon: "i-lucide-wand-2",
    title: t("nav.edit"),
    desc: t("edit.desc"),
    to: "/edit",
  },
]);

const statusItems = computed(() => [
  {
    icon: "i-lucide-circle-dot",
    label: t("home.status.api"),
    value: ready.value ? t("home.status.ready") : t("home.status.needConfig"),
    color: ready.value ? ("success" as const) : ("warning" as const),
  },
  {
    icon: "i-lucide-server",
    label: t("home.status.model"),
    value: selectedModelLabel.value,
    color: "neutral" as const,
    mono: true,
  },
  {
    icon: "i-lucide-palette",
    label: t("home.status.theme"),
    value: themeLabel.value,
    color: "neutral" as const,
  },
  {
    icon: "i-lucide-zap",
    label: t("home.status.stream"),
    value: cfg.config.stream ? t("common.on") : t("common.off"),
    color: cfg.config.stream ? ("success" as const) : ("neutral" as const),
  },
]);

// ─── Recent images ──────────────────────────────────────────────────────
const RECENT_LIMIT = 8;
const recent = computed(() => cache.entries.slice(0, RECENT_LIMIT));
const stats = computed(() => statsOf(cache.entries));

const thumbUrls = ref<Record<string, string>>({});

watch(
  recent,
  async (entries) => {
    for (const e of entries) {
      if (thumbUrls.value[e.id]) continue;
      if (!e.files[0]) continue;
      try {
        const bytes = await readEntryImage(e.files[0]);
        const mime =
          e.ext === "jpeg" ? "image/jpeg" : e.ext === "webp" ? "image/webp" : "image/png";
        const url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: mime })
        );
        thumbUrls.value = { ...thumbUrls.value, [e.id]: url };
      } catch (err) {
        console.warn("thumb load failed", err);
      }
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  Object.values(thumbUrls.value).forEach((u) => URL.revokeObjectURL(u));
});

function relTime(ts: number): string {
  const delta = (Date.now() - ts) / 1000;
  if (delta < 60) return t("historyPage.relTime.justNow");
  if (delta < 3600) return t("historyPage.relTime.minutesAgo", { n: Math.floor(delta / 60) });
  if (delta < 86400) return t("historyPage.relTime.hoursAgo", { n: Math.floor(delta / 3600) });
  if (delta < 86400 * 7) return t("historyPage.relTime.daysAgo", { n: Math.floor(delta / 86400) });
  return new Date(ts).toLocaleDateString();
}

function openEntryDetail(entry: CacheEntry) {
  void router.push(`/history/${entry.id}`);
}

function reuseEntryPrompt(entry: CacheEntry) {
  pendingPrompt.set(entry.prompt, entry.page);
  void router.push(`/${entry.page}`);
}
</script>

<template>
  <div ref="root" class="flex flex-col gap-8">
    <!-- Hero -->
    <header v-anim class="flex flex-col gap-3">
      <div class="flex items-center gap-2 text-xs text-toned font-mono uppercase tracking-wider">
        <span class="w-1 h-1 rounded-full bg-primary" />
        <span>{{ greeting }}</span>
        <span class="text-toned">·</span>
        <span>{{ version ? `v${version}` : "" }}</span>
      </div>

      <h1 class="font-semibold leading-[0.94] tracking-tight text-highlighted">
        <span class="block text-5xl md:text-6xl lg:text-7xl">
          Hi <span class="text-primary">I'M</span>
        </span>
        <span class="block text-3xl md:text-4xl lg:text-5xl mt-1">
          ImageManager<span class="text-primary">.</span>
        </span>
      </h1>

      <p class="text-sm text-muted max-w-[540px] leading-relaxed">
        {{ t("home.tagline") }}
      </p>
    </header>

    <!-- Workflows -->
    <section v-anim class="flex flex-col gap-3">
      <div class="text-xs font-mono uppercase tracking-wider text-toned px-1.5">
        {{ t("home.workflowsLabel") }}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UCard
          v-for="w in workflows"
          :key="w.to"
          class="cursor-pointer transition hover:shadow-md hover:-translate-y-0.5"
          @click="router.push(w.to)"
        >
          <div class="mb-4 w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <UIcon :name="w.icon" class="size-5" />
          </div>
          <h3 class="text-xl font-semibold text-highlighted mb-1.5">{{ w.title }}</h3>
          <p class="text-sm text-muted line-clamp-2 mb-4">{{ w.desc }}</p>
          <div class="flex items-center gap-1.5 text-sm text-muted">
            <span>{{ t("home.open") }}</span>
            <UIcon name="i-lucide-arrow-right" class="size-3.5" />
          </div>
        </UCard>
      </div>
    </section>

    <!-- Recent images -->
    <section v-anim class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3 px-1.5">
        <span class="text-xs font-mono uppercase tracking-wider text-toned">
          {{ t("home.recentLabel") }}
        </span>
        <div class="flex items-center gap-3">
          <span v-if="stats.entryCount > 0" class="text-[10.5px] font-mono text-toned hidden md:inline">
            {{ t("historyPage.entryCount", { count: stats.entryCount, images: stats.imageCount }) }}
          </span>
          <UButton
            v-if="recent.length > 0"
            variant="link"
            size="xs"
            color="primary"
            trailing-icon="i-lucide-arrow-right"
            to="/history"
          >
            {{ t("home.viewAll") }}
          </UButton>
        </div>
      </div>

      <div
        v-if="recent.length === 0"
        class="flex flex-col items-center gap-3 py-10 text-toned border border-dashed border-default rounded-md"
      >
        <UIcon name="i-lucide-image-plus" class="size-7 text-muted" />
        <div class="text-center">
          <div class="text-sm text-muted">{{ t("home.recentEmpty") }}</div>
          <UButton
            variant="link"
            size="xs"
            color="primary"
            trailing-icon="i-lucide-arrow-right"
            to="/generate"
            class="mt-1"
          >
            {{ t("home.recentEmptyCta") }}
          </UButton>
        </div>
      </div>

      <div
        v-else
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-3"
      >
        <UCard
          v-for="entry in recent"
          :key="entry.id"
          :ui="{ body: 'p-0' }"
          class="overflow-hidden group cursor-pointer transition hover:shadow-md"
          @click="openEntryDetail(entry)"
        >
          <div class="relative aspect-square bg-elevated">
            <img
              v-if="thumbUrls[entry.id]"
              :src="thumbUrls[entry.id]"
              alt=""
              class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
            <div v-else class="absolute inset-0 animate-pulse bg-elevated" />
            <UBadge
              :label="entry.page === 'generate' ? 'GEN' : 'EDIT'"
              color="neutral"
              variant="solid"
              size="xs"
              class="absolute top-1.5 left-1.5 font-mono text-[9px] tracking-wider"
            />
            <UButton
              icon="i-lucide-corner-down-left"
              variant="solid"
              color="primary"
              size="xs"
              class="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              :aria-label="t('historyPage.usePrompt')"
              :title="t('historyPage.usePrompt')"
              @click.stop="reuseEntryPrompt(entry)"
            />
          </div>
          <div class="p-2.5">
            <div class="text-xs text-highlighted line-clamp-2 leading-snug">
              {{ entry.prompt }}
            </div>
            <div class="flex items-center gap-1.5 mt-1 text-[10.5px] font-mono text-toned">
              <span>{{ relTime(entry.timestamp) }}</span>
              <span>·</span>
              <span class="truncate">{{ entry.size }}</span>
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <!-- Status -->
    <section v-anim class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3 px-1.5">
        <span class="text-xs font-mono uppercase tracking-wider text-toned">
          {{ t("home.statusLabel") }}
        </span>
        <UButton
          v-if="!ready"
          variant="link"
          size="xs"
          color="primary"
          icon="i-lucide-settings"
          trailing-icon="i-lucide-arrow-right"
          to="/settings"
        >
          {{ t("home.gotoSettings") }}
        </UButton>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <UCard v-for="(item, i) in statusItems" :key="i" :ui="{ body: 'p-3 sm:p-3' }">
          <div class="flex items-center gap-3">
            <UAvatar
              :icon="item.icon"
              size="sm"
              :ui="{ root: item.color === 'success' ? 'bg-success/15 text-success' : item.color === 'warning' ? 'bg-warning/15 text-warning' : 'bg-elevated text-toned' }"
            />
            <div class="min-w-0 flex-1">
              <div class="text-[10.5px] font-mono uppercase tracking-wider text-toned">
                {{ item.label }}
              </div>
              <div
                :class="[
                  'text-sm font-medium text-highlighted truncate mt-0.5',
                  item.mono ? 'font-mono text-xs' : '',
                ]"
              >
                {{ item.value }}
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </section>
  </div>
</template>
