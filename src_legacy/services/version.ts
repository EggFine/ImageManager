import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

/**
 * Reads the running app's version via Tauri. Tauri's `version` field points
 * to `../package.json`, so this is the single source of truth.
 * Returns `""` until the async read resolves.
 */
export function useAppVersion(): string {
  const [version, setVersion] = useState("");
  useEffect(() => {
    void getVersion()
      .then(setVersion)
      .catch((e) => console.error("getVersion failed", e));
  }, []);
  return version;
}
