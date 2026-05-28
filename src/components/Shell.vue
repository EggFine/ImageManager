<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useMediaQuery } from "@vueuse/core";
import { gsap } from "gsap";
import type { NavigationMenuItem } from "@nuxt/ui";
import { isConfigured } from "@/services/config";
import { useConfigStore } from "@/stores/config";
import { useCacheStore } from "@/stores/cache";
import { useAppVersion } from "@/services/version";
import ThemeToggle from "./ThemeToggle.vue";
import WinControls from "./WinControls.vue";
import UnconfiguredBanner from "./UnconfiguredBanner.vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const cfgStore = useConfigStore();
const cacheStore = useCacheStore();
const version = useAppVersion();

onMounted(() => {
  void cacheStore.init();
});

// Per-route meta for the dashboard navbar above the RouterView.
const routeMeta = computed(() => {
  const map: Record<string, { title: string; icon: string }> = {
    "/": { title: t("nav.home"), icon: "i-lucide-house" },
    "/generate": { title: t("nav.generate"), icon: "i-lucide-images" },
    "/edit": { title: t("nav.edit"), icon: "i-lucide-wand-2" },
    "/history": { title: t("nav.history"), icon: "i-lucide-clock" },
    "/settings": { title: t("nav.settings"), icon: "i-lucide-settings" },
  };
  return map[route.path] ?? { title: "", icon: "" };
});

const mainItems = computed<NavigationMenuItem[]>(() => [
  {
    label: t("nav.home"),
    icon: "i-lucide-house",
    to: "/",
    active: route.path === "/",
  },
  {
    label: t("nav.generate"),
    icon: "i-lucide-images",
    to: "/generate",
    active: route.path === "/generate",
  },
  {
    label: t("nav.edit"),
    icon: "i-lucide-wand-2",
    to: "/edit",
    active: route.path === "/edit",
  },
  {
    label: t("nav.history"),
    icon: "i-lucide-clock",
    to: "/history",
    active: route.path === "/history",
  },
]);

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
  // Only Settings has a shortcut now (Ctrl/Cmd+S and the conventional
  // Ctrl+, for preferences). The 1-4 numeric route shortcuts were
  // removed along with their sidebar badges.
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
    <UnconfiguredBanner />

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
          class="flex-1 min-w-0 overflow-y-auto px-4 md:px-7 lg:px-10 pt-4 md:pt-6 lg:pt-7 pb-6 md:pb-8 lg:pb-10"
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
      <span class="hidden md:inline text-[10.5px] text-toned font-mono tracking-wider shrink-0">
        {{ version ? `v${version}` : "" }}
      </span>
    </footer>
  </div>
</template>
