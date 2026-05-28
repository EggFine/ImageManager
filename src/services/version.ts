import { ref, type Ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";

/**
 * Vue composable that reads the running app's version via Tauri. Tauri's
 * `version` field points to `../package.json`, so this is the single
 * source of truth. The returned ref starts as `""` and resolves to the
 * real version once the async read completes.
 */
export function useAppVersion(): Ref<string> {
  const version = ref("");
  void getVersion()
    .then((v) => (version.value = v))
    .catch((e) => console.error("getVersion failed", e));
  return version;
}
