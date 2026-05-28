<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { isConfigured } from "@/services/config";
import { useConfigStore } from "@/stores/config";
import { useOnboardingStore } from "@/stores/onboarding";

const { t } = useI18n();
const cfg = useConfigStore();
const onboarding = useOnboardingStore();

const shouldShow = computed(() => {
  if (!cfg.ready) return false;
  if (isConfigured(cfg.config)) return false;
  if (onboarding.bannerDismissed) return false;
  return true;
});
</script>

<template>
  <UAlert
    v-if="shouldShow"
    color="warning"
    variant="subtle"
    icon="i-lucide-triangle-alert"
    :title="t('banner.unconfigured')"
    :close="{ onClick: () => onboarding.dismissBanner() }"
    :actions="[
      {
        label: t('banner.openWizard'),
        color: 'warning',
        variant: 'link',
        trailingIcon: 'i-lucide-arrow-right',
        onClick: () => onboarding.open(),
      },
    ]"
  />
</template>
