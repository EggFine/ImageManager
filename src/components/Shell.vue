<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter, RouterView } from "vue-router";
import { isConfigured } from "@/services/config";
import { useConfigStore } from "@/stores/config";
import { useCacheStore } from "@/stores/cache";
import { useAppVersion } from "@/services/version";
import TitleBar from "./TitleBar.vue";
import UnconfiguredBanner from "./UnconfiguredBanner.vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const cfgStore = useConfigStore();
const cacheStore = useCacheStore();
const version = useAppVersion();

// Hydrate the image cache once on app boot.
onMounted(() => {
  void cacheStore.init();
});

const navItems = computed(() => [
  { id: "home", to: "/", label: t("nav.home"), icon: "i-lucide-house", shortcut: "Ctrl 1" },
  { id: "generate", to: "/generate", label: t("nav.generate"), icon: "i-lucide-images", shortcut: "Ctrl 2" },
  { id: "edit", to: "/edit", label: t("nav.edit"), icon: "i-lucide-wand-2", shortcut: "Ctrl 3" },
  { id: "history", to: "/history", label: t("nav.history"), icon: "i-lucide-clock", shortcut: "Ctrl 4" },
]);

const ready = computed(() => isConfigured(cfgStore.config));
const fallbackStatus = computed(() => (ready.value ? t("status.ready") : t("status.needConfig")));

// Global shortcuts: Ctrl/Cmd 1-5 → switch route, Ctrl+, → settings
function onKey(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
  const map: Record<string, string> = {
    "1": "/",
    "2": "/generate",
    "3": "/edit",
    "4": "/history",
    "5": "/settings",
    ",": "/settings",
  };
  const path = map[e.key];
  if (path) {
    e.preventDefault();
    void router.push(path);
  }
}

onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="h-full flex flex-col">
    <TitleBar />
    <UnconfiguredBanner />

    <div class="flex-1 min-h-0 flex">
      <!-- Sidebar -->
      <aside
        class="shrink-0 flex flex-col border-r border-default bg-elevated/40 w-[56px] lg:w-[204px] transition-[width] duration-200 ease-out"
      >
        <div class="pt-2 pb-3 lg:pt-5 lg:px-5">
          <span class="hidden lg:inline-block text-[10.5px] font-mono uppercase tracking-[0.16em] text-toned">
            {{ t("nav.sectionLabel") }}
          </span>
        </div>

        <nav class="flex flex-col gap-1 px-2">
          <UButton
            v-for="item in navItems"
            :key="item.id"
            :to="item.to"
            :icon="item.icon"
            :variant="route.path === item.to ? 'subtle' : 'ghost'"
            :color="route.path === item.to ? 'primary' : 'neutral'"
            size="sm"
            class="justify-start lg:justify-start"
            :class="route.path === item.to ? '' : 'text-muted'"
          >
            <span class="hidden lg:inline flex-1 text-left">{{ item.label }}</span>
            <UKbd
              v-if="item.shortcut"
              class="hidden xl:inline-flex shrink-0 ml-auto"
              size="sm"
            >
              {{ item.shortcut }}
            </UKbd>
          </UButton>
        </nav>

        <div class="flex-1" />

        <div class="pb-3 flex flex-col gap-1 px-2">
          <USeparator class="mx-2 lg:mx-3 my-3" />
          <UButton
            to="/settings"
            icon="i-lucide-settings"
            :variant="route.path === '/settings' ? 'subtle' : 'ghost'"
            :color="route.path === '/settings' ? 'primary' : 'neutral'"
            size="sm"
            class="justify-start"
          >
            <span class="hidden lg:inline flex-1 text-left">{{ t("nav.settings") }}</span>
            <UKbd class="hidden xl:inline-flex shrink-0 ml-auto" size="sm">Ctrl 5</UKbd>
          </UButton>
        </div>
      </aside>

      <!-- Main content -->
      <main class="flex-1 min-w-0 overflow-y-auto px-4 md:px-7 lg:px-10 pt-4 md:pt-6 lg:pt-7 pb-6 md:pb-8 lg:pb-10 relative">
        <RouterView />
      </main>
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
