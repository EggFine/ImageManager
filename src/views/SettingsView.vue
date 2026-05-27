<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useConfigStore } from "@/stores/config";
import { useCacheStore } from "@/stores/cache";
import { statsOf } from "@/services/imageCache";
import { useAppVersion } from "@/services/version";
import { checkForUpdate, downloadAndInstall, type UpdateInfo } from "@/services/updater";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { AppConfig } from "@/services/config";
import type { TabsItem } from "@nuxt/ui";
import ConnectionTab from "@/components/settings/ConnectionTab.vue";
import ModelsTab from "@/components/settings/ModelsTab.vue";
import ParamsTab from "@/components/settings/ParamsTab.vue";

const { t } = useI18n();
const cfg = useConfigStore();
const cache = useCacheStore();
const toast = useToast();
const version = useAppVersion();

const REPO_URL = "https://github.com/EggFine/ImageManager";

const tab = ref("appearance");

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
const checking = ref(false);
const installing = ref(false);
const updateInfo = ref<UpdateInfo | null>(null);

async function handleCheckUpdate() {
  checking.value = true;
  updateInfo.value = null;
  try {
    const info = await checkForUpdate();
    if (info) {
      updateInfo.value = info;
      toast.add({
        title: t("updater.available", { version: info.version }),
        description: t("updater.availableBody"),
        color: "info",
      });
    } else {
      toast.add({
        title: t("updater.upToDate"),
        description: `v${version.value}`,
        color: "success",
      });
    }
  } catch (e) {
    toast.add({
      title: t("updater.failed"),
      description: e instanceof Error ? e.message : String(e),
      color: "error",
    });
  }
  checking.value = false;
}

async function handleInstallUpdate() {
  if (!updateInfo.value) return;
  installing.value = true;
  try {
    await downloadAndInstall(updateInfo.value);
  } catch (e) {
    toast.add({
      title: t("updater.failed"),
      description: e instanceof Error ? e.message : String(e),
      color: "error",
    });
    installing.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-5 max-w-5xl">
    <div>
      <h1 class="text-3xl font-semibold text-highlighted">{{ t("settings.title") }}</h1>
      <p class="text-sm text-muted mt-1">{{ t("settings.subtitle") }}</p>
    </div>

    <UTabs v-model="tab" :items="tabs" class="w-full">
      <!-- Appearance -->
      <template #appearance>
        <UCard class="mt-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField :label="t('settings.theme')">
              <USelect
                :model-value="cfg.config.theme"
                :items="[
                  { label: t('settings.themeSystem'), value: 'system' },
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
              <div class="flex items-center gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-primary" />
                <span class="font-mono text-xs uppercase tracking-[0.16em] text-toned">
                  ImageManager
                </span>
              </div>
              <h2 class="text-3xl font-semibold leading-tight text-highlighted">
                Hi<span class="text-primary">.</span>
                <br />
                <span class="italic font-normal text-muted">I'm </span>
                <span>ImageManager</span>
                <span class="text-primary">.</span>
              </h2>
              <div class="font-mono text-xs text-toned tracking-wider">
                {{ t("about.versionLabel") }}
                <span class="text-muted">{{ version ? `v${version}` : "…" }}</span>
              </div>
            </div>

            <div class="flex-1 min-w-0 flex flex-col gap-5">
              <p class="text-sm text-muted leading-relaxed">{{ t("about.description") }}</p>

              <div class="flex flex-wrap gap-2">
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
                <UButton
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-package-open"
                  @click="openUrl(`${REPO_URL}/releases`)"
                >
                  {{ t("about.viewReleases") }}
                </UButton>
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
              </div>

              <UAlert
                v-if="updateInfo"
                color="primary"
                variant="soft"
                icon="i-lucide-circle-check"
                :title="t('updater.available', { version: updateInfo.version })"
                :description="updateInfo.body ?? undefined"
                :actions="[
                  {
                    label: installing ? t('updater.installing') : t('updater.installAndRestart'),
                    color: 'primary',
                    icon: 'i-lucide-download',
                    loading: installing,
                    onClick: handleInstallUpdate,
                  },
                ]"
              />

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
            </div>
          </div>
        </UCard>
      </template>
    </UTabs>
  </div>
</template>
