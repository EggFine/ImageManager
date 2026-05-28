import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  version: string;
  body?: string | null;
  date?: string | null;
}

// The Tauri Update class uses JS private fields (`#foo`). When the
// object is placed inside Vue's reactive system (e.g. a Pinia store's
// ref), Vue wraps it in a Proxy — and calling methods on the proxy
// fails with "Cannot read private member from an object whose class
// did not declare it" because private fields are class-installed slots
// that aren't visible through a Proxy `this`.
//
// To avoid that, UpdateInfo carries only plain data fields. The actual
// Update instance lives here at module scope and is never exposed to
// the reactive layer. `downloadAndInstall` re-resolves it from this
// stash. There's at most one update in flight per app lifetime, so a
// single module-level ref is sufficient.
let pendingUpdate: Update | null = null;

/** Wraps the updater plugin so the rest of the app deals in plain data.
 *  - `check()` runs an HTTP request to the configured endpoint and either
 *    returns `null` (no update) or the parsed manifest.
 *  - On network / pubkey / endpoint config errors it throws — callers should
 *    catch and surface gracefully (we treat "no internet" as a non-event).
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const update = await check();
  pendingUpdate = update;
  if (!update) return null;
  return {
    version: update.version,
    body: update.body,
    date: update.date,
  };
}

/** Downloads + installs the update payload, then re-launches the app.
 *  Caller should make UI block during this (it can take minutes on slow
 *  nets). Throws if `checkForUpdate()` wasn't called first or returned
 *  no update — the stashed Update instance is the only thing we can
 *  install. The `info` argument is a sanity check that the caller is
 *  installing the version they thought they were. */
export async function downloadAndInstall(info: UpdateInfo): Promise<void> {
  if (!pendingUpdate) {
    throw new Error("No pending update — call checkForUpdate() first");
  }
  if (pendingUpdate.version !== info.version) {
    throw new Error(
      `Update version mismatch: stashed ${pendingUpdate.version}, asked ${info.version}`
    );
  }
  await pendingUpdate.downloadAndInstall();
  // On Windows / Linux the NSIS / .deb installer typically asks for a restart
  // implicitly; on macOS the .dmg overwrite needs an explicit relaunch.
  await relaunch();
}
