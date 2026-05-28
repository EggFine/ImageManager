import { defineStore } from "pinia";
import { ref } from "vue";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { checkForUpdate, downloadAndInstall, type UpdateInfo } from "@/services/updater";
import { useAppVersion } from "@/services/version";

export type UpdateState = "idle" | "checking" | "latest" | "available" | "error";

const RELEASES_API =
  "https://api.github.com/repos/EggFine/ImageManager/releases?per_page=30";

interface GithubRelease {
  tag_name: string;
  name?: string | null;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
}

/** Best-effort numeric semver comparison. Strips a leading `v`, drops
 *  any `-pre` / `+build` suffix, then compares major/minor/patch as
 *  integers. Returns -1/0/+1. Unknown / malformed parts coerce to 0. */
function semverCmp(a: string, b: string): number {
  const norm = (s: string) =>
    s.replace(/^v/, "").split(/[-+]/)[0].split(".").map((x) => Number(x) || 0);
  const pa = norm(a);
  const pb = norm(b);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

// App-wide singleton for the updater. Hoisted out of HomeView so:
//   - Switching pages does NOT re-trigger a network check (the store
//     keeps the previous result and `runCheck()` is a no-op while in-
//     flight, so navigation flicker doesn't matter).
//   - Other surfaces (footer pill, Settings → About) can subscribe to
//     the same state without each running their own check.
//
// On a successful "available" check we additionally try to pull the
// intermediate Releases bodies from GitHub so a user who skipped one
// or more versions sees the combined changelog, not just the target
// version's notes. The Tauri updater's latest.json only carries the
// target version's body — multi-version aggregation requires the
// Releases API.
//
// The first check is triggered once at app boot from App.vue.
// `runCheck(force)` lets the user manually re-run.
export const useUpdatesStore = defineStore("updates", () => {
  const state = ref<UpdateState>("idle");
  const info = ref<UpdateInfo | null>(null);
  const installing = ref(false);
  const lastCheckedAt = ref<number | null>(null);

  /** Concatenated bodies for every release strictly newer than the
   *  running version, up to and including the target. Newest first.
   *  Null when single-version (no intermediate releases) or when the
   *  GitHub Releases API fetch failed — callers fall back to `info.body`. */
  const aggregatedBody = ref<string | null>(null);

  const runningVersion = useAppVersion();

  async function fetchAggregatedNotes(targetVersion: string): Promise<string | null> {
    const current = runningVersion.value;
    if (!current) return null;
    try {
      // Tauri http plugin: avoids CORS, identifies as the app (not the
      // webview). GitHub's unauth limit is 60 req/hr per IP, which is
      // plenty since this only runs when an update is detected.
      const resp = await tauriFetch(RELEASES_API, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "ImageManager-updater",
        },
      });
      if (!resp.ok) {
        console.warn("releases fetch non-ok", resp.status);
        return null;
      }
      const releases = (await resp.json()) as GithubRelease[];
      // Window: strictly newer than current, ≤ target. Skip drafts &
      // pre-releases — the in-app updater only follows stable.
      const inRange = releases.filter((r) => {
        if (r.draft || r.prerelease) return false;
        const v = r.tag_name;
        return semverCmp(v, current) > 0 && semverCmp(v, targetVersion) <= 0;
      });
      if (inRange.length === 0) return null;
      // Newest first so the user reads recent changes at the top of
      // the popover.
      inRange.sort((a, b) => semverCmp(b.tag_name, a.tag_name));
      // Don't add an extra "## v1.x" header if the body already has
      // one (the changelog convention in this repo uses ## h2s).
      return inRange
        .map((r) => {
          const tag = r.tag_name.replace(/^v/, "");
          const body = (r.body ?? "").trim();
          const hasOwnHeader = /^##\s+v?\d/.test(body);
          return hasOwnHeader ? body : `## v${tag}\n\n${body || "_(no notes)_"}`;
        })
        .join("\n\n---\n\n");
    } catch (e) {
      console.warn("releases fetch failed", e);
      return null;
    }
  }

  async function runCheck(force = false) {
    if (state.value === "checking") return;
    // Skip silent re-checks; the user can `force=true` from the card
    // or the About tab.
    if (!force && state.value !== "idle" && state.value !== "error") return;
    state.value = "checking";
    aggregatedBody.value = null;
    try {
      const next = await checkForUpdate();
      info.value = next;
      state.value = next ? "available" : "latest";
      if (next) {
        // Fire-and-forget: the popover will reactively pick up the
        // aggregated body when it lands, falling back to info.body in
        // the meantime. Slower networks just see single-version notes
        // for a moment.
        void fetchAggregatedNotes(next.version).then((body) => {
          aggregatedBody.value = body;
        });
      }
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

  return {
    state,
    info,
    installing,
    lastCheckedAt,
    aggregatedBody,
    runCheck,
    install,
  };
});
