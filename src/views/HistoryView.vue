<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useConfigStore } from "@/stores/config";
import { useCacheStore } from "@/stores/cache";
import { usePendingPromptStore } from "@/stores/pendingPrompt";
import { statsOf, type CacheEntry } from "@/services/imageCache";
import EntryCard from "@/components/history/EntryCard.vue";

const { t } = useI18n();
const router = useRouter();
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
  <div>
    <header class="mb-4 flex items-start justify-between gap-3">
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

    <div v-else class="flex flex-col gap-3">
      <div class="px-1.5 -mt-1">
        <span class="font-mono text-xs tracking-wider text-toned">
          {{
            t("historyPage.entryCount", { count: stats.entryCount, images: stats.imageCount })
          }}
        </span>
      </div>
      <EntryCard
        v-for="entry in cache.entries"
        :key="entry.id"
        :entry="entry"
        @use-prompt="usePrompt(entry)"
        @delete="cache.remove(entry.id)"
      />
    </div>
  </div>
</template>
