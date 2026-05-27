<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useConfigStore } from "@/stores/config";
import { isConfigured } from "@/services/config";
import { useAppVersion } from "@/services/version";

const { t } = useI18n();
const router = useRouter();
const cfg = useConfigStore();
const version = useAppVersion();

const ready = computed(() => isConfigured(cfg.config));

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return t("home.greetMorning");
  if (h >= 12 && h < 18) return t("home.greetAfternoon");
  if (h >= 18 && h < 23) return t("home.greetEvening");
  return t("home.greetNight");
});

const themeLabel = computed(() => {
  const theme = cfg.config.theme;
  if (theme === "system") return t("home.status.themeSystem");
  if (theme === "light") return t("home.status.themeLight");
  return t("home.status.themeDark");
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
    shortcut: "Ctrl 2",
    to: "/generate",
  },
  {
    icon: "i-lucide-wand-2",
    title: t("nav.edit"),
    desc: t("edit.desc"),
    shortcut: "Ctrl 3",
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
</script>

<template>
  <div class="flex flex-col gap-8">
    <!-- Hero -->
    <header class="flex flex-col gap-3">
      <div class="flex items-center gap-2 text-xs text-toned font-mono uppercase tracking-wider">
        <span class="w-1 h-1 rounded-full bg-primary" />
        <span>{{ greeting }}</span>
        <span class="text-toned">·</span>
        <span>{{ version ? `v${version}` : "" }}</span>
        <span class="hidden md:inline text-toned">·</span>
        <span class="hidden md:inline">OpenAI compatible</span>
      </div>

      <h1 class="font-semibold leading-[0.94] tracking-tight">
        <span class="block text-5xl md:text-6xl lg:text-7xl text-highlighted">
          Hi<span class="text-primary">.</span>
        </span>
        <span class="block text-3xl md:text-4xl lg:text-5xl text-muted mt-1">
          <span class="italic font-normal">I'm </span>
          <span class="text-highlighted">ImageManager</span>
          <span class="text-primary">.</span>
        </span>
      </h1>

      <p class="text-sm text-muted max-w-[540px] leading-relaxed">
        {{ t("home.tagline") }}
      </p>
    </header>

    <!-- Workflows -->
    <section class="flex flex-col gap-3">
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
          <div class="flex items-start justify-between mb-4">
            <div class="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <UIcon :name="w.icon" class="size-5" />
            </div>
            <UKbd size="sm">{{ w.shortcut }}</UKbd>
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

    <!-- Status -->
    <section class="flex flex-col gap-3">
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
          :to="'/settings'"
        >
          {{ t("home.gotoSettings") }}
        </UButton>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <UCard
          v-for="(item, i) in statusItems"
          :key="i"
          :ui="{ body: 'p-3 sm:p-3' }"
        >
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
