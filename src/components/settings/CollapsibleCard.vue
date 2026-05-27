<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  title: string;
  subtitle?: string;
  removeLabel: string;
}>();
const emit = defineEmits<{ remove: [] }>();

const expanded = ref(false);
</script>

<template>
  <div class="rounded-md border border-default bg-elevated/30">
    <div class="flex items-center gap-2 px-3.5 py-2.5">
      <button
        type="button"
        class="flex-1 min-w-0 flex items-center gap-2 text-left rounded-sm transition-colors hover:bg-elevated/40"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <UIcon
          name="i-lucide-chevron-right"
          :class="['shrink-0 size-3.5 text-muted transition-transform duration-150', expanded && 'rotate-90']"
        />
        <span class="text-sm font-medium text-highlighted truncate">{{ title }}</span>
        <span v-if="subtitle" class="text-xs text-toned font-mono truncate ml-2">
          {{ subtitle }}
        </span>
      </button>
      <UButton
        :icon="'i-lucide-trash-2'"
        variant="ghost"
        color="error"
        size="xs"
        :aria-label="removeLabel"
        :title="removeLabel"
        @click="emit('remove')"
      />
    </div>
    <div v-if="expanded" class="px-3.5 pb-3.5 pt-1">
      <slot />
    </div>
  </div>
</template>
