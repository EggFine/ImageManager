<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useMediaQuery } from "@vueuse/core";
import { gsap } from "gsap";
import { marked } from "marked";
import type { NavigationMenuItem } from "@nuxt/ui";
import { isConfigured } from "@/services/config";
import { useConfigStore } from "@/stores/config";
import { useCacheStore } from "@/stores/cache";
import { useTasksStore, type RunningTask } from "@/stores/tasks";
import { useUpdatesStore } from "@/stores/updates";
import { readEntryImage, type CacheEntry } from "@/services/imageCache";
import { useAppVersion } from "@/services/version";
import ThemeToggle from "./ThemeToggle.vue";
import WinControls from "./WinControls.vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const cfgStore = useConfigStore();
const cacheStore = useCacheStore();
const tasksStore = useTasksStore();
const updatesStore = useUpdatesStore();
const version = useAppVersion();

// Footer "new version available" indicator. Always-visible accent pill
// next to the running version so the user gets a persistent nudge to
// upgrade. Clicking the pill opens a popover with the new version's
// release notes + an in-place install button — no need to navigate
// away from whatever the user is doing.
const updateAvailable = computed(
  () => updatesStore.state === "available" && updatesStore.info != null
);

// Footer popover renders the aggregated body (covering every release
// between current and target) when the store has it; falls back to
// the single target-version body from latest.json while the
// aggregation is in flight or if the GitHub API call failed.
const renderedUpdateNotes = computed<string>(() => {
  const body = updatesStore.aggregatedBody ?? updatesStore.info?.body;
  if (!body) return "";
  return marked.parse(body, { breaks: true, async: false }) as string;
});

function installUpdate() {
  void updatesStore.install();
}

function gotoTask(task: RunningTask) {
  // Running tasks live in the tasks store and are addressed via
  // /create?task=<id>. The receiving view watches `route.query.task` so
  // its mode (form / generating / result) tracks the URL.
  void router.push({ path: "/create", query: { task: task.id } });
}

async function gotoCacheEntry(entry: CacheEntry) {
  // Sidebar "最近生成" routes back into the /create result view (not
  // the standalone history detail), so the user lands on the same
  // surface they'd see right after a fresh generation — with re-roll,
  // edit-this-image, save, etc. all available in one place. Hydrate
  // the cache entry into the tasks store as a `done` task (idempotent
  // — same id, so re-clicks don't duplicate), then route to
  // /create?task=<id> where CreateView's mode computed picks it up.
  await tasksStore.hydrateFromCache(entry);
  void router.push({ path: "/create", query: { task: entry.id } });
}

// ── Sidebar "active" claim logic ───────────────────────────────
// The conventional rule (main nav item with `to` matching the current
// route is active) is overridden for /create when there's a task in
// flight — the active highlight moves to whichever sidebar item most
// closely represents what the user is looking at (running task ⇒
// progress chip, done task ⇒ recent chip, no task ⇒ main "创作" nav).
// Other routes (Home, History, Settings) follow the standard rule.

function isCreateRoute(path: string): boolean {
  return path === "/create";
}

/** ID of the sidebar entry that should hold the active highlight.
 *  Driven by `/create?task=<id>`. Both running-task chips and cache-
 *  entry chips route to that URL (recent entries get hydrated into
 *  the tasks store on click so the same `?task=` plumbing works for
 *  either source). When the query is absent, the main-nav item wins. */
const claimedTaskId = computed<string | null>(() => {
  if (!isCreateRoute(route.path)) return null;
  const id = route.query.task;
  return typeof id === "string" ? id : null;
});

// Recent done generations — sourced from the disk-persisted cache so
// chips survive page reload and remain visible after restart. This is
// the same data the Home page's "最近生成" grid uses; the sidebar shows
// a smaller compact slice.
//
// "进行中" still comes from the in-memory tasks store: by nature, an
// active fetch can't survive a window reload (the stream context is
// gone), so running tasks are transient regardless.
const RECENT_SIDEBAR_LIMIT = 6;
const recentEntries = computed<CacheEntry[]>(() =>
  cacheStore.entries.slice(0, RECENT_SIDEBAR_LIMIT)
);

// Blob URLs for "Recent" thumbnails. Managed manually so we revoke on
// removal — `URL.createObjectURL` leaks until explicitly revoked. Reads
// the first file of each cache entry from disk on demand.
const recentThumbs = ref<Map<string, string>>(new Map());

function bytesToImgUrl(bytes: Uint8Array, ext: string): string {
  const mime = ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
}

watch(
  recentEntries,
  async (entries) => {
    const next = new Map<string, string>();
    for (const e of entries) {
      const existing = recentThumbs.value.get(e.id);
      if (existing) {
        next.set(e.id, existing);
        continue;
      }
      const filename = e.files[0];
      if (!filename) continue;
      try {
        const bytes = await readEntryImage(filename);
        next.set(e.id, bytesToImgUrl(bytes, e.ext));
      } catch (err) {
        console.warn("sidebar thumb load failed", err);
      }
    }
    // Revoke URLs that fell out of the slice (entry removed or shifted
    // past the limit) so we don't leak blob handles over a long session.
    for (const [id, url] of recentThumbs.value) {
      if (!next.has(id)) URL.revokeObjectURL(url);
    }
    recentThumbs.value = next;
  },
  { immediate: true, deep: true }
);

onUnmounted(() => {
  for (const url of recentThumbs.value.values()) URL.revokeObjectURL(url);
});

onMounted(() => {
  void cacheStore.init();
});

// Per-route meta for the dashboard navbar above the RouterView.
const routeMeta = computed(() => {
  const map: Record<string, { title: string; icon: string }> = {
    "/": { title: t("nav.home"), icon: "i-lucide-house" },
    "/create": { title: t("nav.create"), icon: "i-lucide-sparkles" },
    "/history": { title: t("nav.history"), icon: "i-lucide-clock" },
    "/settings": { title: t("nav.settings"), icon: "i-lucide-settings" },
  };
  return map[route.path] ?? { title: "", icon: "" };
});

// "创作" main-nav item loses its `active` highlight when a task is
// being viewed via ?task=… — the highlight delegates to whichever
// sidebar chip (running / recent) represents that task.
const mainItems = computed<NavigationMenuItem[]>(() => {
  const claim = claimedTaskId.value;
  return [
    {
      label: t("nav.home"),
      icon: "i-lucide-house",
      to: "/",
      active: route.path === "/",
    },
    {
      label: t("nav.create"),
      icon: "i-lucide-sparkles",
      to: "/create",
      badge: "Ctrl N",
      active: route.path === "/create" && !claim,
    },
    {
      label: t("nav.history"),
      icon: "i-lucide-clock",
      to: "/history",
      active: route.path === "/history",
    },
  ];
});

const footerItems = computed<NavigationMenuItem[]>(() => [
  {
    label: t("nav.settings"),
    icon: "i-lucide-settings",
    to: "/settings",
    badge: "Ctrl S",
    active: route.path === "/settings",
  },
]);

const ready = computed(() => isConfigured(cfgStore.config));
const fallbackStatus = computed(() => (ready.value ? t("status.ready") : t("status.needConfig")));

// Two-threshold responsive sidebar:
//   width ≥ lg (1024px) → expanded
//   md..lg (768–1023px) → collapsed icon rail
//   width < md (< 768px) → hidden via v-show (NOT v-if)
//
// IMPORTANT: hide via `v-show`, not `v-if`. USidebar caches the last
// `modelOpen` value into an internal `desktopOpen` ref at setup and
// uses it to restore expanded state when crossing back into lg+. If we
// unmount USidebar on the <md hide, that cache is lost on re-mount and
// it gets re-initialized to whatever sidebarOpen happens to be at that
// moment (often `false` from prior mobile-mode emit), so widening back
// to lg+ would stay collapsed. v-show keeps the component mounted and
// preserves the cache across the hide cycle.
const isMd = useMediaQuery("(min-width: 768px)");
const sidebarOpen = ref(true);

function onKey(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
  // Ctrl/Cmd+N → fresh /create (no ?task query, so always a clean form)
  if (e.key === "n" || e.key === "N") {
    e.preventDefault();
    void router.push("/create");
    return;
  }
  // Ctrl/Cmd+S (and the conventional Ctrl+, for preferences) → settings
  if (e.key === "s" || e.key === "S" || e.key === ",") {
    e.preventDefault();
    void router.push("/settings");
  }
}

onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));

// Route transition — short cross-fade out + slide-in.
// `prefers-reduced-motion` users skip animation entirely.
//
// IMPORTANT: the enter handler does NOT touch opacity. The `v-anim`
// directive (see useEnterAnimation.ts) owns child opacity — it pre-sets
// `opacity: 0` in `beforeMount` (before DOM insertion, so the first
// paint of the new view shows the from-state) and the composable tweens
// it back to 1 with a stagger. If we also faded the root, the two
// opacities would multiply during the overlap window and items would
// briefly look stuck at partial opacity. Leaving opacity to the child
// stagger and reserving the root for a simple y-shift keeps both
// animations on independent properties.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
function onRouteEnter(el: Element, done: () => void) {
  if (reduceMotion.matches) {
    done();
    return;
  }
  gsap.fromTo(
    el,
    { y: 12 },
    {
      y: 0,
      duration: 0.34,
      ease: "power3.out",
      clearProps: "transform",
      onComplete: done,
    }
  );
}
function onRouteLeave(el: Element, done: () => void) {
  if (reduceMotion.matches) {
    done();
    return;
  }
  gsap.to(el, {
    opacity: 0,
    y: -6,
    duration: 0.18,
    ease: "power2.in",
    onComplete: done,
  });
}
</script>

<template>
  <div class="h-full flex flex-col">

    <!-- USidebar with `collapsible="icon"`. The default theme uses
         `position: fixed inset-y-0 h-svh` on the container slot, which
         would normally cover our TitleBar and status footer. Two tricks
         make it behave inside our shell:
           (1) `transform-gpu` on the wrapper creates a new "containing
               block" for `position: fixed` descendants (CSS spec) — the
               sidebar container anchors to this wrapper instead of viewport.
           (2) `:ui.container = '!h-full'` overrides `h-svh` so the
               container fills the wrapper's height, not the viewport.
         Combined, the icon-collapse + rail behave normally but contained. -->
    <div class="flex-1 min-h-0 flex transform-gpu">
      <!-- USidebar in `collapsible="icon"` is a multi-root component
           (Primitive + mobile Menu), so `v-show` can't go directly on it
           — Vue warns "Runtime directive used on component with non-element
           root node". Wrap in a `display: contents` div: v-show toggles
           display:none on the wrapper (hiding everything), and otherwise
           the wrapper is transparent to flex / fixed-positioning. -->
      <div v-show="isMd" class="contents">
      <USidebar
        v-model:open="sidebarOpen"
        collapsible="icon"
        rail
        :ui="{
          root: 'md:block',
          container: '!h-full md:!flex',
          inner: 'bg-elevated/40',
        }"
      >
        <template #header="{ state }">
          <div
            data-tauri-drag-region
            :class="[
              'flex items-center size-full select-none',
              state === 'collapsed' && 'justify-center',
            ]"
          >
            <span
              v-if="state === 'collapsed'"
              class="font-bold leading-none text-highlighted text-base"
            >
              I'M<span class="text-primary">.</span>
            </span>
            <span
              v-else
              class="font-bold leading-none text-highlighted text-lg tracking-tight"
            >
              ImageManager<span class="text-primary">.</span>
            </span>
          </div>
        </template>

        <template #default="{ state }">
          <UNavigationMenu
            :collapsed="state === 'collapsed'"
            :items="mainItems"
            orientation="vertical"
            :ui="{
              link: 'px-3 py-2.5 gap-2.5',
              linkLeadingIcon: 'size-[18px]',
            }"
          />
          <!-- Running tasks group. Always rendered (group header + chips
               or an empty-state line) so the sidebar has a stable layout —
               the section doesn't appear/disappear as tasks come and go.
               Each chip routes back to /create?task=<id>; the one that
               matches the URL picks up the active highlight. -->
          <div
            class="mt-4 flex flex-col gap-1"
            :class="state === 'collapsed' && 'items-center'"
          >
            <span
              v-if="state !== 'collapsed'"
              class="px-3 text-[10px] font-mono uppercase tracking-[0.16em] text-toned"
            >
              {{ t("sidebar.runningGroup") }}
            </span>
            <template v-if="tasksStore.running.length > 0">
              <button
                v-for="task in tasksStore.running"
                :key="task.id"
                type="button"
                :title="task.prompt"
                :class="[
                  'flex items-center gap-2.5 rounded-md transition text-left',
                  claimedTaskId === task.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-elevated/70 text-highlighted',
                  state === 'collapsed' ? 'p-2 justify-center' : 'px-3 py-2',
                ]"
                @click="gotoTask(task)"
              >
                <span class="relative w-[18px] h-[18px] shrink-0">
                  <span class="absolute inset-0 rounded-full border-2 border-default" />
                  <span class="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                </span>
                <template v-if="state !== 'collapsed'">
                  <span class="flex-1 min-w-0 text-xs leading-snug truncate">
                    {{ task.prompt || t("sidebar.untitledTask") }}
                  </span>
                  <UIcon
                    :name="task.kind === 'generate' ? 'i-lucide-images' : 'i-lucide-wand-2'"
                    class="size-3.5 text-toned shrink-0"
                  />
                </template>
              </button>
            </template>
            <!-- Empty state — same vertical rhythm as a real chip, but
                 quieter typography so it reads as "nothing here" rather
                 than a clickable item. Collapsed rail shows a dimmed dot
                 instead so the column doesn't widen. -->
            <template v-else>
              <div
                v-if="state !== 'collapsed'"
                class="px-3 py-1.5 text-[11px] italic text-toned/80 leading-snug"
              >
                {{ t("sidebar.runningEmpty") }}
              </div>
              <div
                v-else
                :title="t('sidebar.runningEmpty')"
                class="w-[18px] h-[18px] flex items-center justify-center"
              >
                <span class="w-1 h-1 rounded-full bg-toned/40" />
              </div>
            </template>
          </div>

          <!-- Recent (done) group, cache-backed. Reads from the disk
               history so chips persist across page reload / restart.
               Click → /history/<id>, where the user can see all results,
               re-use the prompt, or export. The chip claims the active
               highlight when the user is viewing its detail page. -->
          <div
            v-if="recentEntries.length > 0"
            class="mt-3 flex flex-col gap-1"
            :class="state === 'collapsed' && 'items-center'"
          >
            <span
              v-if="state !== 'collapsed'"
              class="px-3 text-[10px] font-mono uppercase tracking-[0.16em] text-toned"
            >
              {{ t("sidebar.recentGroup") }}
            </span>
            <button
              v-for="entry in recentEntries"
              :key="entry.id"
              type="button"
              :title="entry.prompt"
              :class="[
                'flex items-center gap-2.5 rounded-md transition text-left',
                claimedTaskId === entry.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-elevated/70 text-highlighted',
                state === 'collapsed' ? 'p-2 justify-center' : 'px-3 py-2',
              ]"
              @click="gotoCacheEntry(entry)"
            >
              <!-- Square thumb at 18px to match nav icons. Falls back to
                   a kind-appropriate Lucide icon if the blob URL didn't
                   materialize (e.g. the disk file is gone). -->
              <span
                class="relative w-[18px] h-[18px] shrink-0 rounded-sm overflow-hidden bg-elevated"
              >
                <img
                  v-if="recentThumbs.get(entry.id)"
                  :src="recentThumbs.get(entry.id)"
                  alt=""
                  class="size-full object-cover"
                  draggable="false"
                />
                <UIcon
                  v-else
                  :name="entry.page === 'generate' ? 'i-lucide-images' : 'i-lucide-wand-2'"
                  class="absolute inset-0 m-auto size-3 text-toned"
                />
              </span>
              <template v-if="state !== 'collapsed'">
                <span class="flex-1 min-w-0 text-xs leading-snug truncate">
                  {{ entry.prompt || t("sidebar.untitledTask") }}
                </span>
                <span
                  class="font-mono text-[9.5px] tracking-wider text-toned shrink-0 tabular-nums"
                >
                  ×{{ entry.files.length }}
                </span>
              </template>
            </button>
          </div>

          <UNavigationMenu
            :collapsed="state === 'collapsed'"
            :items="footerItems"
            orientation="vertical"
            class="mt-auto"
            :ui="{
              link: 'px-3 py-2.5 gap-2.5',
              linkLeadingIcon: 'size-[18px]',
            }"
          />
        </template>
      </USidebar>
      </div>

      <div class="flex-1 min-w-0 flex flex-col">
        <!-- DashboardNavbar doubles as title bar + drag region. Tauri's
             `data-tauri-drag-region` attribute makes the row a window-drag
             handle; interactive children (buttons in #right) still
             receive their own clicks. -->
        <UDashboardNavbar
          data-tauri-drag-region
          :title="routeMeta.title"
          :icon="routeMeta.icon"
          :toggle="false"
        >
          <template #right>
            <ThemeToggle />
            <USeparator orientation="vertical" class="h-5 mx-1" />
            <WinControls />
          </template>
        </UDashboardNavbar>
        <main
          class="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-4 md:px-7 lg:px-10 pt-4 md:pt-6 lg:pt-7 pb-6 md:pb-8 lg:pb-10"
        >
          <RouterView v-slot="{ Component, route: r }">
            <Transition
              :css="false"
              mode="out-in"
              @enter="onRouteEnter"
              @leave="onRouteLeave"
            >
              <component :is="Component" :key="r.fullPath" />
            </Transition>
          </RouterView>
        </main>
      </div>
    </div>

    <!-- Status footer -->
    <footer
      class="h-7 shrink-0 border-t border-default px-3 md:px-5 flex items-center justify-between gap-3 bg-elevated/40"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <span
          aria-hidden
          :class="[
            'block w-1.5 h-1.5 rounded-full shrink-0',
            ready ? 'bg-success' : 'bg-warning',
          ]"
        />
        <span class="text-[11.5px] text-muted tracking-tight truncate">
          {{ cfgStore.status || fallbackStatus }}
        </span>
      </div>
      <div class="hidden md:flex items-center gap-2 shrink-0">
        <!-- Persistent "new version available" pill. Only renders when
             the app-singleton updates store has surfaced an update.
             Clicking opens a popover with the release notes + an
             in-place "立即更新" action so the user can upgrade without
             navigating away from their current view. -->
        <UPopover
          v-if="updateAvailable && updatesStore.info"
          :ui="{ content: 'w-[360px] max-h-[420px] overflow-hidden' }"
        >
          <button
            type="button"
            class="release-pill flex items-center gap-1.5 px-2 py-[2px] rounded-md text-[10px] font-mono tracking-wider bg-primary/15 text-primary hover:bg-primary/25 transition"
          >
            <span>{{ t("update.footerBadge") }}</span>
            <span class="tabular-nums opacity-90">
              v{{ version ?? "—" }} → v{{ updatesStore.info.version }}
            </span>
          </button>
          <template #content>
            <div class="p-3 flex flex-col gap-2.5">
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold text-highlighted text-sm">
                  {{ t("update.popover.title") }}
                </span>
                <span class="font-mono text-[10.5px] text-toned tabular-nums">
                  v{{ version ?? "—" }} → v{{ updatesStore.info.version }}
                </span>
              </div>
              <div
                v-if="renderedUpdateNotes"
                class="release-notes text-xs text-toned max-h-56 overflow-y-auto pr-1"
                v-html="renderedUpdateNotes"
              />
              <p v-else class="text-xs text-toned italic">
                {{ t("home.update.notesUnavailable") }}
              </p>
              <UButton
                color="primary"
                size="sm"
                icon="i-lucide-download"
                :loading="updatesStore.installing"
                block
                @click="installUpdate"
              >
                {{ t("home.update.installAction") }}
              </UButton>
            </div>
          </template>
        </UPopover>
        <span class="text-[10.5px] text-toned font-mono tracking-wider">
          {{ version ? `v${version}` : "" }}
        </span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Tight, theme-aware styling for marked-rendered release notes inside
   the footer update popover. Mirrors HomeView's `.release-notes` rules
   but a touch more compact since the popover is smaller. `:deep()` is
   required to reach into `v-html`-injected DOM. */
.release-notes :deep(h1),
.release-notes :deep(h2),
.release-notes :deep(h3) {
  font-weight: 600;
  font-size: 0.78rem;
  color: var(--ui-text-highlighted);
  margin: 0.25rem 0 0.15rem;
}
.release-notes :deep(h1:first-child),
.release-notes :deep(h2:first-child),
.release-notes :deep(h3:first-child) {
  margin-top: 0;
}
.release-notes :deep(p) {
  margin: 0.15rem 0;
  line-height: 1.45;
}
.release-notes :deep(ul),
.release-notes :deep(ol) {
  padding-left: 1.1rem;
  margin: 0.15rem 0;
}
.release-notes :deep(ul) { list-style: disc; }
.release-notes :deep(ol) { list-style: decimal; }
.release-notes :deep(li) {
  margin: 0;
  line-height: 1.45;
}
.release-notes :deep(hr) {
  margin: 0.3rem 0;
  border: 0;
  border-top: 1px solid var(--ui-border);
}
.release-notes :deep(blockquote) {
  margin: 0.2rem 0;
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
  font-size: 0.9em;
}
</style>
