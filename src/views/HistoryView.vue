<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useConfigStore } from "@/stores/config";
import { useCacheStore } from "@/stores/cache";
import { usePendingPromptStore } from "@/stores/pendingPrompt";
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
  void router.push(`/${entry.page}`);
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
      v-if="cache.entries.length === 0"
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
