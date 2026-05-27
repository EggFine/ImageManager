import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  version: string;
  body?: string | null;
  date?: string | null;
  /** The plugin's Update instance. Typed as `unknown` here so private-field
   *  drift across plugin versions doesn't cascade through the codebase —
   *  we only call .downloadAndInstall() on it, in this file. */
  raw: unknown;
}

/** Wraps the updater plugin so the rest of the app deals in plain data.
 *  - `check()` runs an HTTP request to the configured endpoint and either
 *    returns `null` (no update) or the parsed manifest.
 *  - On network / pubkey / endpoint config errors it throws — callers should
 *    catch and surface gracefully (we treat "no internet" as a non-event).
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    body: update.body,
    date: update.date,
    raw: update,
  };
}

/** Downloads + installs the update payload, then re-launches the app.
 *  Caller should make UI block during this (it can take minutes on slow nets). */
export async function downloadAndInstall(info: UpdateInfo): Promise<void> {
  await (info.raw as { downloadAndInstall(): Promise<void> }).downloadAndInstall();
  // On Windows / Linux the NSIS / .deb installer typically asks for a restart
  // implicitly; on macOS the .dmg overwrite needs an explicit relaunch.
  await relaunch();
}
