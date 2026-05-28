<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { gsap } from "gsap";
import { marked } from "marked";
import { useI18n } from "vue-i18n";
import { useToast } from "@nuxt/ui/composables";
import { useConfigStore } from "@/stores/config";
import { useCacheStore } from "@/stores/cache";
import { useUpdatesStore } from "@/stores/updates";
import { statsOf } from "@/services/imageCache";
import { useAppVersion } from "@/services/version";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { AppConfig } from "@/services/config";
import type { TabsItem } from "@nuxt/ui";
import ConnectionTab from "@/components/settings/ConnectionTab.vue";
import ModelsTab from "@/components/settings/ModelsTab.vue";
import ParamsTab from "@/components/settings/ParamsTab.vue";
import { useEnterAnimation } from "@/composables/useEnterAnimation";

const { t } = useI18n();
const cfg = useConfigStore();
const cache = useCacheStore();
const toast = useToast();
const version = useAppVersion();

const root = ref<HTMLElement | null>(null);
useEnterAnimation(root);

const REPO_URL = "https://github.com/EggFine/ImageManager";

const tab = ref("appearance");

// Tab content swap animation. Reka UI's TabsContent renders the active
// panel with `role="tabpanel" data-state="active"`. On every `tab` change
// we wait one tick for the swap, then fade+slide the new active panel in.
// `prefers-reduced-motion: reduce` users skip animation entirely.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
watch(
  () => tab.value,
  async () => {
    if (reduceMotion.matches || !root.value) return;
    await nextTick();
    const panel = root.value.querySelector<HTMLElement>(
      '[role="tabpanel"][data-state="active"]'
    );
    if (!panel) return;
    gsap.fromTo(
      panel,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.28, ease: "power3.out" }
    );
  }
);

const tabs = computed<TabsItem[]>(() => [
  { value: "appearance", label: t("settings.tab.appearance"), icon: "i-lucide-palette", slot: "appearance" as const },
  { value: "connection", label: t("settings.tab.connection"), icon: "i-lucide-plug", slot: "connection" as const },
  { value: "models", label: t("settings.tab.models"), icon: "i-lucide-brain", slot: "models" as const },
  { value: "params", label: t("settings.tab.params"), icon: "i-lucide-sliders", slot: "params" as const },
  { value: "generation", label: t("settings.tab.generation"), icon: "i-lucide-wand-2", slot: "generation" as const },
  { value: "about", label: t("settings.tab.about"), icon: "i-lucide-info", slot: "about" as const },
]);

const cacheStats = computed(() => statsOf(cache.entries));

function patch(p: Partial<AppConfig>) {
  void cfg.update(p);
}

async function pickSaveDir() {
  const picked = await openDialog({ directory: true });
  if (typeof picked === "string") patch({ save_directory: picked });
}

async function openConfigFile() {
  try {
    await openPath(cfg.configPath);
  } catch (e) {
    toast.add({ title: String(e), color: "error" });
  }
}

async function revealConfigFile() {
  try {
    await revealItemInDir(cfg.configPath);
  } catch (e) {
    toast.add({ title: String(e), color: "error" });
  }
}

async function clearCache() {
  if (!confirm(t("historyPage.confirmClear"))) return;
  await cache.clear();
}

// ─── About / Updater ───
// Wires the About tab into the app-singleton updates store so all
// three surfaces (Home update card, footer pill, this tab) stay in
// sync. Toasts cover the explicit-user-action flow on this tab.
const updates = useUpdatesStore();
const {
  state: updateState,
  info: updateInfo,
  installing,
  aggregatedBody: aggregatedUpdateBody,
} = storeToRefs(updates);

const checking = computed(() => updateState.value === "checking");
const hasUpdate = computed(
  () => updateState.value === "available" && updateInfo.value != null
);

async function handleCheckUpdate() {
  const before = updateState.value;
  await updates.runCheck(true);
  // Surface the outcome via a toast — the user clicked an explicit
  // "Check for updates" action and expects feedback. We deliberately
  // don't auto-toast on the silent boot check.
  const next = updateState.value;
  if (next === "available" && updateInfo.value) {
    if (before !== "available") {
      toast.add({
        title: t("updater.available", { version: updateInfo.value.version }),
        description: t("updater.availableBody"),
        color: "info",
      });
    }
  } else if (next === "latest") {
    toast.add({
      title: t("updater.upToDate"),
      description: `v${version.value}`,
      color: "success",
    });
  } else if (next === "error") {
    toast.add({
      title: t("updater.failed"),
      description: t("home.update.errorLine"),
      color: "error",
    });
  }
}

async function handleInstallUpdate() {
  try {
    await updates.install();
  } catch (e) {
    toast.add({
      title: t("updater.failed"),
      description: e instanceof Error ? e.message : String(e),
      color: "error",
    });
  }
}

// ─── Bundled CHANGELOG.md for the "查看当前版本更新日志" popover.
// Same source the Home update card uses for the `latest` state — the
// developer-maintained file in /public/CHANGELOG.md, shipped with the
// bundle so it's always offline-available and always matches the
// running version. Loaded once on mount.
const localChangelog = ref<string>("");

onMounted(async () => {
  try {
    const resp = await fetch("/CHANGELOG.md");
    if (resp.ok) localChangelog.value = await resp.text();
  } catch (e) {
    console.warn("CHANGELOG.md fetch failed", e);
  }
});

const renderedLocalChangelog = computed<string>(() => {
  if (!localChangelog.value) return "";
  return marked.parse(localChangelog.value, { breaks: true, async: false }) as string;
});

// Body shown on the "available" alert: prefer the aggregated multi-
// release notes (so users on older versions see everything they're
// catching up on); fall back to the single target-version body while
// the GitHub Releases fetch is in flight or has failed.
const renderedUpdateBody = computed<string>(() => {
  const raw = aggregatedUpdateBody.value ?? updateInfo.value?.body ?? "";
  if (!raw) return "";
  return marked.parse(raw, { breaks: true, async: false }) as string;
});
</script>

<template>
  <div ref="root" class="flex flex-col gap-5">
    <div v-anim>
      <h1 class="text-3xl font-semibold text-highlighted">{{ t("settings.title") }}</h1>
      <p class="text-sm text-muted mt-1">{{ t("settings.subtitle") }}</p>
    </div>

    <UTabs v-anim v-model="tab" :items="tabs" class="w-full">
      <!-- Appearance -->
      <template #appearance>
        <UCard class="mt-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField :label="t('settings.theme')">
              <USelect
                :model-value="cfg.config.theme"
                :items="[
                  { label: t('settings.themeLight'), value: 'light' },
                  { label: t('settings.themeDark'), value: 'dark' },
                ]"
                class="w-full"
                @update:model-value="patch({ theme: $event as AppConfig['theme'] })"
              />
            </UFormField>
            <UFormField :label="t('settings.language')">
              <USelect
                :model-value="cfg.config.language"
                :items="[
                  { label: t('settings.langSystem'), value: 'system' },
                  { label: t('settings.langZh'), value: 'zh-Hans' },
                  { label: t('settings.langEn'), value: 'en-US' },
                ]"
                class="w-full"
                @update:model-value="patch({ language: $event as AppConfig['language'] })"
              />
            </UFormField>
          </div>

          <USeparator class="my-4" />

          <UFormField :label="t('settings.followSystemTheme')" :description="t('settings.followSystemThemeHint')">
            <div class="flex items-center gap-3 h-9">
              <USwitch
                :model-value="cfg.config.follow_system_theme"
                @update:model-value="patch({ follow_system_theme: $event })"
              />
              <span class="text-sm text-muted">
                {{ cfg.config.follow_system_theme ? t("common.on") : t("common.off") }}
              </span>
            </div>
          </UFormField>

          <p class="text-xs text-muted mt-3">{{ t("settings.appearanceHint") }}</p>
        </UCard>
      </template>

      <!-- Connection -->
      <template #connection>
        <ConnectionTab class="mt-4" />
      </template>

      <!-- Models -->
      <template #models>
        <ModelsTab class="mt-4" />
      </template>

      <!-- Params -->
      <template #params>
        <ParamsTab class="mt-4" />
      </template>

      <!-- Generation -->
      <template #generation>
        <div class="mt-4 flex flex-col gap-5">
          <UCard>
            <template #header>
              <h3 class="font-semibold">{{ t("settings.section.behavior") }}</h3>
            </template>
            <div class="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4">
              <UFormField :label="t('settings.stream')">
                <div class="flex items-center gap-3 h-9">
                  <USwitch
                    :model-value="cfg.config.stream"
                    @update:model-value="patch({ stream: $event })"
                  />
                  <span class="text-sm text-muted">
                    {{ cfg.config.stream ? t("settings.streamOn") : t("settings.streamOff") }}
                  </span>
                </div>
              </UFormField>
              <UFormField :label="t('settings.partialImages')">
                <UInputNumber
                  :model-value="cfg.config.partial_images"
                  :min="0"
                  :max="3"
                  class="w-full"
                  @update:model-value="patch({ partial_images: $event })"
                />
              </UFormField>
            </div>
            <p class="text-xs text-muted mt-2">{{ t("settings.streamHint") }}</p>

            <USeparator class="my-4" />

            <UFormField :label="t('settings.autoCache')" :description="t('settings.autoCacheHint')">
              <div class="flex items-center gap-3 h-9">
                <USwitch
                  :model-value="cfg.config.auto_cache"
                  @update:model-value="patch({ auto_cache: $event })"
                />
                <span class="text-sm text-muted">
                  {{ cfg.config.auto_cache ? t("settings.autoCacheOn") : t("settings.autoCacheOff") }}
                </span>
              </div>
            </UFormField>
            <div class="flex items-center justify-between gap-3 mt-3">
              <span class="text-xs font-mono text-muted">
                {{ t("settings.cacheStats", { entries: cacheStats.entryCount, images: cacheStats.imageCount }) }}
              </span>
              <UButton
                variant="ghost"
                size="sm"
                color="neutral"
                :disabled="cacheStats.entryCount === 0"
                @click="clearCache"
              >
                {{ t("settings.clearCache") }}
              </UButton>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-semibold">{{ t("settings.section.storage") }}</h3>
            </template>

            <UFormField :label="t('settings.sec.saveDir')">
              <div class="flex gap-2">
                <UInput
                  :model-value="cfg.config.save_directory"
                  readonly
                  :placeholder="t('settings.saveDirPlaceholder') ?? ''"
                  class="flex-1 font-mono"
                />
                <UButton icon="i-lucide-folder-open" @click="pickSaveDir">
                  {{ t("settings.pickDir") }}
                </UButton>
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  :aria-label="t('a11y.clearSaveDir')"
                  @click="patch({ save_directory: '' })"
                />
              </div>
            </UFormField>

            <USeparator class="my-4" />

            <UFormField :label="t('settings.sec.file')">
              <UInput :model-value="cfg.configPath" readonly class="w-full font-mono" />
            </UFormField>
            <div class="flex gap-2 mt-3">
              <UButton icon="i-lucide-file" @click="openConfigFile">
                {{ t("settings.openFile") }}
              </UButton>
              <UButton
                icon="i-lucide-arrow-up-right"
                variant="outline"
                color="neutral"
                @click="revealConfigFile"
              >
                {{ t("settings.revealFile") }}
              </UButton>
            </div>
          </UCard>
        </div>
      </template>

      <!-- About -->
      <template #about>
        <UCard class="mt-4">
          <div class="flex flex-col md:flex-row gap-6 md:gap-8">
            <div class="md:w-[280px] shrink-0 flex flex-col gap-3">
              <h2 class="font-semibold leading-tight text-highlighted">
                <span class="block text-3xl">
                  Hi <span class="text-primary">I'M</span>
                </span>
                <span class="block text-xl mt-1">
                  ImageManager<span class="text-primary">.</span>
                </span>
              </h2>
              <div class="font-mono text-xs text-toned tracking-wider">
                {{ t("about.versionLabel") }}
                <span class="text-muted">{{ version ? `v${version}` : "…" }}</span>
              </div>
            </div>

            <div class="flex-1 min-w-0 flex flex-col gap-5">
              <p class="text-sm text-muted leading-relaxed">{{ t("about.description") }}</p>

              <div class="flex flex-col gap-2">
                <!-- Primary row: three GitHub actions. "查看版本" (view
                     releases) was moved to the second row, right after
                     "查看更新日志" — the two release-history entries
                     live side by side now. -->
                <div class="grid grid-cols-3 gap-2">
                  <UButton color="primary" trailing-icon="i-lucide-arrow-right" @click="openUrl(REPO_URL)">
                    {{ t("about.viewOnGithub") }}
                  </UButton>
                  <UButton
                    variant="outline"
                    color="neutral"
                    icon="i-lucide-star"
                    @click="openUrl(`${REPO_URL}/stargazers`)"
                  >
                    {{ t("about.starOnGithub") }}
                  </UButton>
                  <UButton
                    variant="outline"
                    color="neutral"
                    icon="i-lucide-bug"
                    @click="openUrl(`${REPO_URL}/issues/new`)"
                  >
                    {{ t("about.reportIssue") }}
                  </UButton>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    variant="outline"
                    color="neutral"
                    icon="i-lucide-rotate-ccw"
                    :loading="checking"
                    :disabled="installing"
                    @click="handleCheckUpdate"
                  >
                    {{ checking ? t("updater.checking") : t("updater.checkForUpdates") }}
                  </UButton>

                  <!-- Local changelog popover — shows the current
                       version's release notes (same source the Home
                       update card uses for the `latest` state).
                       Hidden until the bundled file has loaded. -->
                  <UPopover
                    v-if="renderedLocalChangelog"
                    :ui="{ content: 'w-[420px] max-h-[480px] overflow-hidden' }"
                  >
                    <UButton variant="ghost" color="neutral" icon="i-lucide-book-open">
                      {{ t("home.update.viewNotes") }}
                    </UButton>
                    <template #content>
                      <div class="p-3 flex flex-col gap-2">
                        <div class="flex items-center justify-between gap-2">
                          <span class="font-semibold text-highlighted text-sm">
                            {{ t("home.update.notesPopoverTitle") }}
                          </span>
                          <span class="font-mono text-[10.5px] text-toned tabular-nums">
                            v{{ version ?? "—" }}
                          </span>
                        </div>
                        <div
                          class="release-notes text-xs text-toned max-h-80 overflow-y-auto pr-1"
                          v-html="renderedLocalChangelog"
                        />
                      </div>
                    </template>
                  </UPopover>

                  <UButton
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-package-open"
                    @click="openUrl(`${REPO_URL}/releases`)"
                  >
                    {{ t("about.viewReleases") }}
                  </UButton>
                </div>
              </div>

              <!-- Available-update alert. State + body come from the
                   singleton store, so this card mirrors what the Home
                   update card and the footer pill are showing. The
                   description renders the aggregated multi-release
                   body when available — users skipping versions see
                   everything they're catching up on, not just the
                   target's notes. -->
              <UCard
                v-if="hasUpdate && updateInfo"
                :ui="{ body: 'p-4' }"
                class="bg-primary/5 border-primary/30"
              >
                <div class="flex items-start gap-3">
                  <UIcon
                    name="i-lucide-arrow-up-circle"
                    class="size-5 text-primary shrink-0 mt-0.5"
                  />
                  <div class="flex-1 min-w-0 flex flex-col gap-2">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                      <span class="text-sm font-semibold text-highlighted">
                        {{ t("updater.available", { version: updateInfo.version }) }}
                      </span>
                      <span class="font-mono text-[10.5px] tabular-nums text-toned">
                        v{{ version ?? "—" }} → v{{ updateInfo.version }}
                      </span>
                    </div>
                    <div
                      v-if="renderedUpdateBody"
                      class="release-notes text-xs text-toned max-h-48 overflow-y-auto pr-1"
                      v-html="renderedUpdateBody"
                    />
                    <div class="flex items-center gap-2 flex-wrap">
                      <UButton
                        color="primary"
                        size="sm"
                        icon="i-lucide-download"
                        :loading="installing"
                        @click="handleInstallUpdate"
                      >
                        {{ installing ? t("updater.installing") : t("updater.installAndRestart") }}
                      </UButton>
                    </div>
                  </div>
                </div>
              </UCard>

              <USeparator />

              <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                <div class="flex flex-col gap-1">
                  <span class="text-xs font-mono uppercase tracking-wider text-toned">
                    {{ t("about.techStack") }}
                  </span>
                  <span class="font-mono text-xs text-muted leading-relaxed">
                    Tauri 2 · Vue 3<br />
                    TypeScript · Tailwind v4
                  </span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-xs font-mono uppercase tracking-wider text-toned">
                    {{ t("about.license") }}
                  </span>
                  <span class="font-mono text-xs text-muted">{{ t("about.licenseValue") }}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-xs font-mono uppercase tracking-wider text-toned">
                    {{ t("about.credits") }}
                  </span>
                  <span class="font-mono text-xs text-muted leading-relaxed">
                    {{ t("about.creditsValue") }}
                  </span>
                </div>
              </div>

              <USeparator />

              <!-- Donation. QR images live in /public/Donation and are
                   served at the bundle root by Vite/Tauri. -->
              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-heart" class="size-4 text-primary" />
                  <span class="text-sm font-medium text-highlighted">
                    {{ t("about.donateTitle") }}
                  </span>
                </div>
                <p class="text-xs text-muted leading-relaxed">
                  {{ t("about.donateHint") }}
                </p>
                <div class="grid grid-cols-2 gap-3 max-w-sm">
                  <div
                    class="flex flex-col items-center gap-1.5 p-3 rounded-md border border-default bg-elevated/40"
                  >
                    <img
                      src="/Donation/aliPay.jpg"
                      :alt="t('about.donateAlipay')"
                      class="w-full aspect-square object-contain rounded select-none"
                      draggable="false"
                      loading="lazy"
                    />
                    <span class="text-xs font-mono text-muted tracking-wide">
                      {{ t("about.donateAlipay") }}
                    </span>
                  </div>
                  <div
                    class="flex flex-col items-center gap-1.5 p-3 rounded-md border border-default bg-elevated/40"
                  >
                    <img
                      src="/Donation/wxPay.jpg"
                      :alt="t('about.donateWechat')"
                      class="w-full aspect-square object-contain rounded select-none"
                      draggable="false"
                      loading="lazy"
                    />
                    <span class="text-xs font-mono text-muted tracking-wide">
                      {{ t("about.donateWechat") }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </template>
    </UTabs>
  </div>
</template>

<style scoped>
/* Theme-aware styling for marked-rendered release notes (both the
   in-card "available update" body and the local changelog popover).
   `:deep()` is required to reach into `v-html`-injected DOM. */
.release-notes :deep(h1),
.release-notes :deep(h2),
.release-notes :deep(h3) {
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--ui-text-highlighted);
  margin: 0.4rem 0 0.2rem;
}
.release-notes :deep(h1:first-child),
.release-notes :deep(h2:first-child),
.release-notes :deep(h3:first-child) {
  margin-top: 0;
}
.release-notes :deep(p) {
  margin: 0.15rem 0;
  line-height: 1.5;
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
  line-height: 1.5;
}
.release-notes :deep(hr) {
  margin: 0.4rem 0;
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
