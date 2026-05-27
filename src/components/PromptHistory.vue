<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useHistoryStore, type HistoryPage } from "@/stores/history";

const props = defineProps<{ page: HistoryPage }>();
const emit = defineEmits<{ pick: [prompt: string] }>();

const { t } = useI18n();
const historyStore = useHistoryStore();

onMounted(() => historyStore.hydrate());

const list = computed(() => {
  const same = historyStore.history.filter((e) => e.page === props.page);
  const other = historyStore.history.filter((e) => e.page !== props.page);
  return [...same, ...other].slice(0, 30);
});

function relTime(ts: number): string {
  const delta = (Date.now() - ts) / 1000;
  if (delta < 60) return `${Math.floor(delta)}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  if (delta < 86400 * 7) return `${Math.floor(delta / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}
</script>

<template>
  <UPopover :ui="{ content: 'w-80 max-h-[360px] overflow-hidden' }">
    <UButton
      variant="ghost"
      size="xs"
      color="neutral"
      icon="i-lucide-history"
      :aria-label="t('history.openLabel')"
      :title="t('history.openLabel')"
    >
      <span class="tabular-nums font-mono text-[10.5px]">{{ historyStore.history.length }}</span>
    </UButton>
    <template #content>
      <div class="flex flex-col max-h-[360px]">
        <div class="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-default">
          <span class="text-[10.5px] font-mono uppercase tracking-wider text-toned">
            {{ t("history.title") }}
          </span>
          <UButton
            v-if="historyStore.history.length > 0"
            variant="ghost"
            color="error"
            size="xs"
            icon="i-lucide-trash-2"
            @click="historyStore.clear()"
          >
            {{ t("history.clear") }}
          </UButton>
        </div>
        <div v-if="list.length === 0" class="px-3 py-6 text-center">
          <span class="italic text-sm text-muted">{{ t("history.empty") }}</span>
        </div>
        <ul v-else class="flex-1 overflow-y-auto py-1">
          <li v-for="entry in list" :key="entry.id" class="group relative">
            <button
              type="button"
              class="w-full text-left px-3 py-2 pr-8 transition-colors hover:bg-elevated/70"
              @click="emit('pick', entry.prompt)"
            >
              <div
                :class="[
                  'text-xs leading-snug line-clamp-2',
                  entry.page !== page ? 'text-toned' : 'text-highlighted',
                ]"
              >
                {{ entry.prompt }}
              </div>
              <div class="flex items-center gap-2 mt-1 text-[10.5px] text-toned font-mono">
                <span class="uppercase">{{ entry.page === "generate" ? "gen" : "edit" }}</span>
                <span>·</span>
                <span>{{ relTime(entry.ts) }}</span>
              </div>
            </button>
            <UButton
              variant="ghost"
              color="error"
              size="xs"
              icon="i-lucide-x"
              class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              :aria-label="t('history.removeEntry')"
              @click.stop="historyStore.remove(entry.id)"
            />
          </li>
        </ul>
      </div>
    </template>
  </UPopover>
</template>
