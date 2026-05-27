import { create } from "zustand";

/**
 * Tiny UI store that connects the OnboardingDialog (mounted in App.tsx)
 * with anything that wants to *open* it imperatively — currently the
 * UnconfiguredBanner at the top of Shell, but could later be a button
 * in Settings, etc.
 *
 * Also tracks whether the banner has been dismissed for this session
 * (so we don't nag the user when they've explicitly said "later").
 */
interface OnboardingStore {
  /** True when something other than first-launch wants the dialog open. */
  manualOpen: boolean;
  /** Banner suppressed for this app run only. Reset on relaunch. */
  bannerDismissed: boolean;

  open: () => void;
  close: () => void;
  dismissBanner: () => void;
}

export const useOnboarding = create<OnboardingStore>((set) => ({
  manualOpen: false,
  bannerDismissed: false,
  open: () => set({ manualOpen: true, bannerDismissed: false }),
  close: () => set({ manualOpen: false }),
  dismissBanner: () => set({ bannerDismissed: true }),
}));
