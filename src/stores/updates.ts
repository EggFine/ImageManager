import { defineStore } from "pinia";
import { ref } from "vue";
import { checkForUpdate, downloadAndInstall, type UpdateInfo } from "@/services/updater";

export type UpdateState = "idle" | "checking" | "latest" | "available" | "error";

// App-wide singleton for the updater. Hoisted out of HomeView so:
//   - Switching pages does NOT re-trigger a network check (the store
//     keeps the previous result and `runCheck()` is a no-op while in-
//     flight, so navigation flicker doesn't matter).
//   - Other surfaces (sidebar footer badge) can subscribe to the same
//     `state` / `info` without each running their own check.
//
// The first check is triggered once at app boot from App.vue.
// `runCheck(force)` lets the user manually re-run from the Home card.
export const useUpdatesStore = defineStore("updates", () => {
  const state = ref<UpdateState>("idle");
  const info = ref<UpdateInfo | null>(null);
  const installing = ref(false);
  const lastCheckedAt = ref<number | null>(null);

  async function runCheck(force = false) {
    if (state.value === "checking") return;
    // Skip silent re-checks; the user can `force=true` from the card.
    if (!force && state.value !== "idle" && state.value !== "error") return;
    state.value = "checking";
    try {
      const next = await checkForUpdate();
      info.value = next;
      state.value = next ? "available" : "latest";
    } catch (e) {
      console.warn("update check failed", e);
      state.value = "error";
    } finally {
      lastCheckedAt.value = Date.now();
    }
  }

  async function install() {
    if (!info.value) return;
    installing.value = true;
    try {
      await downloadAndInstall(info.value);
    } finally {
      installing.value = false;
    }
  }

  return { state, info, installing, lastCheckedAt, runCheck, install };
});
