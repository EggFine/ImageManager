import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { join, resourceDir, appConfigDir } from "@tauri-apps/api/path";
import { platform } from "@tauri-apps/plugin-os";

export interface AppConfig {
  base_url: string;
  api_key: string;
  generation_model: string;
  edit_model: string;
  default_aspect_ratio: string;
  default_resolution: string;
  advanced_size_mode: boolean;
  default_size: string;
  send_response_format: boolean;
  timeout_seconds: number;
  verify_ssl: boolean;
  stream: boolean;
  partial_images: number;
  input_fidelity: "auto" | "high" | "low";
  theme: "system" | "light" | "dark";
  backdrop: "mica" | "micaalt" | "acrylic" | "none";
  language: "system" | "zh-Hans" | "en-US";
  save_directory: string;
}

export const defaultConfig: AppConfig = {
  base_url: "https://api.openai.com/v1",
  api_key: "",
  generation_model: "gpt-image-2",
  edit_model: "gpt-image-2",
  default_aspect_ratio: "1:1",
  default_resolution: "1080p",
  advanced_size_mode: false,
  default_size: "1024x1024",
  send_response_format: false,
  timeout_seconds: 180,
  verify_ssl: true,
  stream: true,
  partial_images: 2,
  input_fidelity: "auto",
  theme: "system",
  backdrop: "mica",
  language: "system",
  save_directory: "",
};

let cachedConfigPath: string | null = null;

/**
 * Config file location strategy (per-platform).
 *
 *   Windows  → `<exe_dir>/config.json`
 *              Portable "green" mode. Tauri's `resourceDir()` on Windows
 *              resolves to the directory containing the running `.exe`.
 *
 *   macOS    → `~/Library/Application Support/<bundle-id>/config.json`
 *              `.app/Contents/Resources/` is code-signed read-only after
 *              distribution, so we use the standard user config dir.
 *
 *   Linux    → `~/.config/<bundle-id>/config.json`
 *              Tauri's `resourceDir()` on Linux redirects to
 *              `/usr/lib/<pkg>/` for deb/rpm installs (root-owned), and
 *              into a read-only mount inside an AppImage. User config
 *              dir is the only universally writable choice.
 */
export async function getConfigPath(): Promise<string> {
  if (cachedConfigPath) return cachedConfigPath;
  const isPortable = platform() === "windows";
  if (isPortable) {
    // resourceDir() === exe dir on Windows — guaranteed to exist.
    // Skip the exists/mkdir check entirely: Tauri's `$RESOURCE/**` scope
    // only matches *descendants* of the resource dir, not the dir itself,
    // so probing existence on the dir would be rejected by the fs scope.
    cachedConfigPath = await join(await resourceDir(), "config.json");
  } else {
    // macOS / Linux: appConfigDir may not exist on first launch.
    const dir = await appConfigDir();
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });
    cachedConfigPath = await join(dir, "config.json");
  }
  return cachedConfigPath;
}

export async function loadConfig(): Promise<AppConfig> {
  const path = await getConfigPath();
  if (!(await exists(path))) {
    await saveConfig(defaultConfig);
    return { ...defaultConfig };
  }
  try {
    const text = await readTextFile(path);
    const parsed = JSON.parse(text) as Partial<AppConfig>;
    return { ...defaultConfig, ...parsed };
  } catch (e) {
    console.error("config parse failed", e);
    return { ...defaultConfig };
  }
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  const path = await getConfigPath();
  await writeTextFile(path, JSON.stringify(cfg, null, 2));
}

export function isConfigured(cfg: AppConfig): boolean {
  return !!cfg.api_key && !cfg.api_key.toLowerCase().startsWith("sk-replace");
}

export function normalizedBaseUrl(cfg: AppConfig): string {
  return cfg.base_url.replace(/\/+$/, "");
}
