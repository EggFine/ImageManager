<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useConfigStore } from "@/stores/config";
import { useCacheStore } from "@/stores/cache";
import { usePendingPromptStore } from "@/stores/pendingPrompt";
import { useTasksStore, type RunningTask } from "@/stores/tasks";
import { statsOf, type CacheEntry } from "@/services/imageCache";
import EntryCard from "@/components/history/EntryCard.vue";
import { useEnterAnimation } from "@/composables/useEnterAnimation";

const { t } = useI18n();
const router = useRouter();
const root = ref<HTMLElement | null>(null);
useEnterAnimation(root);
const cfg = useConfigStore();
const cache = useCacheStore();
const pendingPrompt = usePendingPromptStore();
const tasks = useTasksStore();

function gotoTask(task: RunningTask) {
  void router.push({ path: "/create", query: { task: task.id } });
}

onMounted(() => {
  void cache.init();
});

const stats = computed(() => statsOf(cache.entries));

async function handleClearAll() {
  if (!confirm(t("historyPage.confirmClear"))) return;
  await cache.clear();
  cfg.setStatus("");
}

function usePrompt(entry: CacheEntry) {
  pendingPrompt.set(entry.prompt, entry.page);
  void router.push("/create");
}
</script>

<template>
  <div ref="root" data-blur-group>
    <header v-anim data-blur-item class="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-highlighted">{{ t("historyPage.title") }}</h1>
        <p class="text-sm text-muted mt-1">{{ t("historyPage.desc") }}</p>
      </div>
      <UButton
        v-if="cache.entries.length > 0"
        variant="ghost"
        color="error"
        icon="i-lucide-trash-2"
        @click="handleClearAll"
      >
        {{ t("historyPage.clearAll") }}
      </UButton>
    </header>

    <UAlert
      v-if="!cfg.config.auto_cache"
      data-blur-item
      color="warning"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :title="t('historyPage.cachingDisabled')"
      :description="t('historyPage.cachingDisabledHint')"
      class="mb-4"
      :actions="[
        {
          label: t('nav.settings'),
          variant: 'outline',
          color: 'warning',
          onClick: () => { void router.push('/settings'); },
        },
      ]"
    />

    <div
      v-if="cache.entries.length === 0 && tasks.running.length === 0"
      class="flex flex-col items-center gap-4 py-16 text-toned"
    >
      <div
        class="w-14 h-14 rounded-full bg-default border border-default flex items-center justify-center"
      >
        <UIcon name="i-lucide-image-plus" class="size-5 text-muted" />
      </div>
      <div class="text-center">
        <div class="italic text-base text-muted">{{ t("historyPage.empty") }}</div>
        <div class="text-xs text-toned mt-1.5">{{ t("historyPage.emptyHint") }}</div>
      </div>
    </div>

    <div v-else class="flex flex-col gap-4">
      <div data-blur-item class="px-1.5">
        <span class="font-mono text-xs tracking-wider text-toned">
          {{
            t("historyPage.entryCount", { count: stats.entryCount, images: stats.imageCount })
          }}
        </span>
      </div>
      <div
        class="grid gap-x-4 gap-y-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <!-- In-flight tasks render as skeleton cards at the top of the
             grid. Clicking one jumps back to the page that owns the
             task so the user can watch its streaming progress. -->
        <button
          v-for="task in tasks.running"
          :key="task.id"
          type="button"
          class="group flex flex-col gap-3 cursor-pointer text-left"
          @click="gotoTask(task)"
        >
          <div class="relative aspect-square rounded-lg overflow-hidden border border-default bg-elevated/40">
            <div class="absolute inset-0 animate-pulse bg-elevated" />
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="relative w-10 h-10">
                <div class="absolute inset-0 rounded-full border-2 border-default" />
                <div class="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
              </div>
            </div>
            <UBadge
              :label="task.kind === 'generate' ? 'GEN' : 'EDIT'"
              color="primary"
              variant="solid"
              size="xs"
              class="absolute top-2 left-2 font-mono text-[9px] tracking-wider z-10 pointer-events-none"
            />
            <span
              class="absolute top-2 right-2 z-10 pointer-events-none px-1.5 py-0.5 rounded font-mono text-[10px] tabular-nums bg-primary/80 text-white"
            >
              {{ t("historyPage.runningBadge") }}
            </span>
          </div>
          <div class="px-0.5 flex flex-col gap-1">
            <p class="text-sm text-highlighted leading-snug line-clamp-2">
              {{ task.prompt || t("sidebar.untitledTask") }}
            </p>
            <div class="flex items-center gap-1.5 text-[10.5px] text-toned font-mono uppercase tracking-wider">
              <span class="text-primary">{{ task.kind }}</span>
              <span>·</span>
              <span class="truncate">{{ task.modelLabel }}</span>
            </div>
          </div>
        </button>

        <EntryCard
          v-for="entry in cache.entries"
          :key="entry.id"
          v-anim
          :entry="entry"
          @use-prompt="usePrompt(entry)"
          @delete="cache.remove(entry.id)"
        />
      </div>
    </div>
  </div>
</template>

<style>
/* Focus-on-hover: when any card in this view is active (a user is hovering
   it), every other blur-item (the other cards, the header, the count line,
   the optional alert) softens via blur + slight desaturation. The active
   card stays sharp on top (it's already z-10), so the fanned-out stack is
   readable against the dimmed background. CSS :has() makes this entirely
   reactive to hover state — no JS bookkeeping needed.

   Non-scoped on purpose: the [data-card-active] attribute lives on an
   EntryCard child component root and Vue's scoped CSS rewriting around
   `:has()` is fragile across nested components. The attribute names are
   specific enough not to collide. */
[data-blur-group] [data-blur-item] {
  /* Fluent Decelerate curve, slowed to 380ms so it lives in roughly the
     same time domain as the card's release tween (~560ms). The filter
     state change starts a hair before the cards settle, fading into
     the lifted final state. */
  transition: filter 380ms cubic-bezier(0.1, 0.9, 0.2, 1);
}
[data-blur-group]:has([data-card-active]) [data-blur-item]:not([data-card-active]) {
  filter: blur(4px) brightness(0.72) saturate(0.82);
}
</style>
