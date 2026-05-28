<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useCacheStore } from "@/stores/cache";
import { usePendingPromptStore } from "@/stores/pendingPrompt";
import { useUpdatesStore } from "@/stores/updates";
import { readEntryImage, statsOf, type CacheEntry } from "@/services/imageCache";
import { useAppVersion } from "@/services/version";
import { useEnterAnimation } from "@/composables/useEnterAnimation";
import UnconfiguredBanner from "@/components/UnconfiguredBanner.vue";
import { marked } from "marked";

const { t } = useI18n();
const router = useRouter();
const cache = useCacheStore();
const pendingPrompt = usePendingPromptStore();
const version = useAppVersion();

const root = ref<HTMLElement | null>(null);
useEnterAnimation(root);

onMounted(() => void cache.init());

// ─── Update card ─────────────────────────────────────────────
// State + info come from the app-singleton updates store (initial
// check fires once in App.vue's onMounted). HomeView is just a view
// onto that state — re-mounting on navigation does not re-trigger
// a network request.
const updates = useUpdatesStore();
const { state: updateState, info: updateInfo, installing } = storeToRefs(updates);

function runUpdateCheck() {
  void updates.runCheck(true);
}

function handleInstallUpdate() {
  void updates.install();
}

// Per-state icon for the card's icon block. `loader-circle` lives in
// the box for both `idle` (pre-check) and `checking` — the animate-spin
// class only spins it during checking. Other states get a semantic
// glyph so the icon still carries meaning when the box is static.
const updateIcon = computed(() => {
  switch (updateState.value) {
    case "available":
      return "i-lucide-arrow-up-circle";
    case "latest":
      return "i-lucide-circle-check";
    case "error":
      return "i-lucide-cloud-off";
    case "checking":
    case "idle":
    default:
      return "i-lucide-loader-circle";
  }
});

// ─── Release notes for the current version ──────────────────
// Shipped with the bundle at /public/CHANGELOG.md, so the notes are
// always available offline and always match the running version. The
// developer maintains this file by hand before each release; the
// release.yml workflow uses the same file to populate the GitHub
// Release body, so the "new version available" notes (delivered via
// latest.json) come from the same source.
const localChangelog = ref<string>("");

async function loadReleaseNotes() {
  try {
    const resp = await fetch("/CHANGELOG.md");
    if (!resp.ok) return;
    localChangelog.value = await resp.text();
  } catch (e) {
    console.warn("CHANGELOG.md fetch failed", e);
  }
}

// The body we actually render: when an update is available we show
// the upgrade target's notes (from the Tauri updater); otherwise we
// show the locally-bundled changelog for the current version.
const releaseBody = computed<string>(() => {
  if (updateState.value === "available" && updateInfo.value?.body) {
    return updateInfo.value.body;
  }
  return localChangelog.value;
});

const renderedReleaseBody = computed<string>(() => {
  if (!releaseBody.value) return "";
  return marked.parse(releaseBody.value, { breaks: true, async: false }) as string;
});

onMounted(() => {
  void loadReleaseNotes();
});

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return t("home.greetMorning");
  if (h >= 12 && h < 18) return t("home.greetAfternoon");
  if (h >= 18 && h < 23) return t("home.greetEvening");
  return t("home.greetNight");
});

const workflows = computed(() => [
  {
    icon: "i-lucide-sparkles",
    title: t("nav.create"),
    desc: t("home.createCardDesc"),
    to: "/create",
  },
]);

// ─── Recent images ──────────────────────────────────────────────────────
// Render up to 6 entries — the grid drops to 4-col at `lg`, where we hide
// the last two via per-item `lg:hidden` so a single row stays clean.
// Below `lg` (2- and 3-col layouts), all 6 show across 2-3 rows.
const RECENT_LIMIT = 6;
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
  void router.push("/create");
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

    <!-- "No endpoint configured" banner — shown only on Home, above the
         workflows so it sits adjacent to the action the user is about to
         attempt. No `v-anim`: the component's root is conditionally
         rendered (v-if inside), so the directive's beforeMount could
         try to set inline style on a comment placeholder. -->
    <UnconfiguredBanner />

    <!-- Two-up: "New creation" entry + "What's new" update status.
         Default grid stretch keeps both cards at the same height so the
         row reads as a balanced pair. The update card's notes area uses
         a max-height + overflow-y-auto so very long changelogs don't
         pull the row tall — the scroll keeps the card the same size. -->
    <section v-anim class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <UCard
        v-for="w in workflows"
        :key="w.to"
        class="h-full cursor-pointer transition hover:shadow-md hover:-translate-y-0.5"
        :ui="{ body: 'h-full flex flex-col' }"
        @click="router.push(w.to)"
      >
        <div class="mb-4 w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <UIcon :name="w.icon" class="size-5" />
        </div>
        <h3 class="text-xl font-semibold text-highlighted mb-1.5">{{ w.title }}</h3>
        <p class="text-sm text-muted line-clamp-2 mb-4">{{ w.desc }}</p>
        <div class="mt-auto flex items-center gap-1.5 text-sm text-muted">
          <span>{{ t("home.open") }}</span>
          <UIcon name="i-lucide-arrow-right" class="size-3.5" />
        </div>
      </UCard>

      <!-- Update / version card. State machine: checking / available /
           latest / error. The icon block at the top mirrors the Create
           card's silhouette so the two cards visually pair; its content
           shifts per state (animated loader during checking, semantic
           icon otherwise). Notes are hidden by default — the user opens
           the popover via "查看更新日志" so the inline card stays compact
           and matches the Create card height.
           `h-full` + body flex-col with `mt-auto` on the action row pins
           the actions to the bottom of the card so both cards always
           render at the same height regardless of internal content. -->
      <UCard class="h-full" :ui="{ body: 'h-full flex flex-col' }">
        <!-- Icon block: same dimensions as Create card's icon. The
             checking state animates the loader inside the box — that's
             the "original" treatment the user prefers. -->
        <div class="mb-4 w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <UIcon
            :name="updateIcon"
            :class="['size-5', updateState === 'checking' && 'animate-spin']"
          />
        </div>

        <h3 class="text-xl font-semibold text-highlighted mb-1.5">
          {{ t("home.update.title") }}
        </h3>

        <!-- Status line: one line per state, no inline notes. -->
        <p class="text-sm text-muted mb-4 line-clamp-2">
          <template v-if="updateState === 'available' && updateInfo">
            {{ t("home.update.availableLine", { version: updateInfo.version }) }}
          </template>
          <template v-else-if="updateState === 'latest'">
            {{ t("home.update.latestLine") }}
          </template>
          <template v-else-if="updateState === 'error'">
            {{ t("home.update.errorLine") }}
          </template>
          <template v-else>
            {{ t("home.update.checkingLine") }}
          </template>
        </p>

        <!-- Action row pinned to bottom so the card height matches Create. -->
        <div class="mt-auto flex items-center gap-2 flex-wrap">
          <!-- Available → install button -->
          <UButton
            v-if="updateState === 'available' && updateInfo"
            color="primary"
            size="sm"
            icon="i-lucide-download"
            :loading="installing"
            @click="handleInstallUpdate"
          >
            {{ t("home.update.installAction") }}
          </UButton>

          <!-- Latest / error → recheck button -->
          <UButton
            v-if="updateState === 'latest' || updateState === 'error'"
            variant="outline"
            size="sm"
            color="neutral"
            icon="i-lucide-rotate-ccw"
            @click="runUpdateCheck"
          >
            {{ t("home.update.recheckAction") }}
          </UButton>

          <!-- "View notes" popover. Hidden during checking (no content
               yet). The notes body is the same `renderedReleaseBody` we
               used inline before — comes from GitHub Release for
               "available", from local CHANGELOG.md otherwise. -->
          <UPopover
            v-if="updateState !== 'checking' && renderedReleaseBody"
            :ui="{ content: 'w-[360px] max-h-[420px] overflow-hidden' }"
          >
            <UButton
              variant="ghost"
              size="sm"
              color="neutral"
              icon="i-lucide-book-open"
            >
              {{ t("home.update.viewNotes") }}
            </UButton>
            <template #content>
              <div class="p-3 flex flex-col gap-2">
                <span class="font-semibold text-highlighted text-sm">
                  {{ t("home.update.notesPopoverTitle") }}
                </span>
                <div
                  class="release-notes text-xs text-toned max-h-72 overflow-y-auto pr-1"
                  v-html="renderedReleaseBody"
                />
              </div>
            </template>
          </UPopover>

          <span class="font-mono text-[10.5px] tabular-nums text-toned ml-auto">
            <template v-if="updateState === 'available' && updateInfo">
              v{{ version ?? "—" }} → v{{ updateInfo.version }}
            </template>
            <template v-else>
              v{{ version ?? "—" }}
            </template>
          </span>
        </div>
      </UCard>
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
            to="/create"
            class="mt-1"
          >
            {{ t("home.recentEmptyCta") }}
          </UButton>
        </div>
      </div>

      <div
        v-else
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
      >
        <UCard
          v-for="(entry, i) in recent"
          :key="entry.id"
          :ui="{ body: 'p-0' }"
          :class="[
            'overflow-hidden group cursor-pointer transition hover:shadow-md',
            // 4-col layout (lg+) shows exactly 4 cards in one tidy row;
            // narrower 2- / 3-col layouts keep all 6 for two rows.
            i >= 4 && 'lg:hidden',
          ]"
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

  </div>
</template>

<style scoped>
/* Tight, theme-aware styling for marked-rendered release notes.
   `:deep()` reaches into v-html'd HTML which scoped styles otherwise
   wouldn't touch. */
.release-notes :deep(h1),
.release-notes :deep(h2),
.release-notes :deep(h3) {
  font-weight: 600;
  font-size: 0.78rem;
  color: var(--ui-text-highlighted);
  margin: 0.2rem 0 0.1rem;
}
.release-notes :deep(h1:first-child),
.release-notes :deep(h2:first-child),
.release-notes :deep(h3:first-child) {
  margin-top: 0;
}
.release-notes :deep(p) {
  margin: 0.1rem 0;
  line-height: 1.4;
}
.release-notes :deep(ul),
.release-notes :deep(ol) {
  padding-left: 1.1rem;
  margin: 0.1rem 0;
}
.release-notes :deep(ul) {
  list-style: disc;
}
.release-notes :deep(ol) {
  list-style: decimal;
}
.release-notes :deep(li) {
  margin: 0;
  line-height: 1.4;
}
.release-notes :deep(hr) {
  margin: 0.25rem 0;
  border: 0;
  border-top: 1px solid var(--ui-border);
}
.release-notes :deep(blockquote) {
  margin: 0.15rem 0;
  padding-left: 0.5rem;
  border-left: 2px solid var(--ui-border);
  color: var(--ui-text-toned);
}
.release-notes :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
}
.release-notes :deep(code) {
  padding: 0.05em 0.3em;
  border-radius: 3px;
  background: var(--ui-bg-elevated);
  font-size: 0.95em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.release-notes :deep(pre) {
  padding: 0.5rem;
  border-radius: 4px;
  background: var(--ui-bg-elevated);
  overflow-x: auto;
  margin: 0.25rem 0;
}
.release-notes :deep(strong) {
  font-weight: 600;
  color: var(--ui-text-highlighted);
}
.release-notes :deep(em) {
  font-style: italic;
}
.release-notes :deep(hr) {
  border: 0;
  border-top: 1px solid var(--ui-border);
  margin: 0.5rem 0;
}
</style>
