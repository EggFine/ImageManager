import { defineStore } from "pinia";

interface State {
  /** True when something other than first-launch wants the dialog open. */
  manualOpen: boolean;
  /** Banner suppressed for this app run only. Reset on relaunch. */
  bannerDismissed: boolean;
}

/** UI-only store: connects the OnboardingDialog mounted in App.vue with
 *  anything that wants to open it imperatively (currently
 *  UnconfiguredBanner; later a "re-run setup" button in Settings). */
export const useOnboardingStore = defineStore("onboarding", {
  state: (): State => ({
    manualOpen: false,
    bannerDismissed: false,
  }),
  actions: {
    open() {
      this.manualOpen = true;
      this.bannerDismissed = false;
    },
    close() {
      this.manualOpen = false;
    },
    dismissBanner() {
      this.bannerDismissed = true;
    },
  },
});
