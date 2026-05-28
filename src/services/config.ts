import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { join, resourceDir, appConfigDir } from "@tauri-apps/api/path";
import { platform } from "@tauri-apps/plugin-os";
import { DEFAULT_BASE_URL, type EndpointType } from "./presets";

/** Schema version. Bumped when the layout becomes incompatible enough that
 *  loadConfig() needs to reset. v2 = multi-endpoint refactor. */
export const CONFIG_SCHEMA_VERSION = 2;

export interface Endpoint {
  id: string;
  name: string;
  type: EndpointType;
  base_url: string;
  api_key: string;
}

export interface ModelEntry {
  id: string;
  endpoint_id: string;
  model_id: string;
  label: string;
  is_custom: boolean;
}

/** A named bundle of OpenAI-compatible output params. Users can save several
 *  and pick one per task from the Generate / Edit pages without touching the
 *  global defaults. */
export interface ParamPreset {
  id: string;
  name: string;
  // Size fields — same shape as cfg.default_* but short-named.
  aspect_ratio: string;
  resolution: string;
  advanced_size_mode: boolean;
  size: string;
  // Output fields
  quality: "auto" | "low" | "medium" | "high";
  output_format: "auto" | "png" | "jpeg" | "webp";
  output_compression: number;
  background: "auto" | "transparent" | "opaque";
  input_fidelity: "auto" | "high" | "low";
}

export interface AppConfig {
  schema_version: number;

  /** Configured providers. Empty until the user adds one via onboarding
   *  or the Connection tab. */
  endpoints: Endpoint[];
  /** User-defined models, each pinned to an endpoint. */
  models: ModelEntry[];
  /** Which ModelEntry to use on the Generate / Edit pages. Empty when
   *  nothing is selected (e.g. all models removed). */
  selected_gen_model_id: string;
  selected_edit_model_id: string;

  /** User-defined output-parameter presets. Picked per task from Generate /
   *  Edit pages. Independent from the global defaults below. */
  param_presets: ParamPreset[];
  /** Which preset (or "global" / "custom") the Generate page is currently
   *  using. Persisted so the user's last choice survives a relaunch. */
  selected_gen_param_source: string;
  selected_edit_param_source: string;

  default_aspect_ratio: string;
  default_resolution: string;
  advanced_size_mode: boolean;
  default_size: string;
  /** Gemini's image API only takes a ratio (no width/height in pixels) —
   *  fed into `generationConfig.imageConfig.aspectRatio` when generating
   *  with a Google endpoint. */
  google_aspect_ratio: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
  send_response_format: boolean;
  timeout_seconds: number;
  verify_ssl: boolean;
  stream: boolean;
  partial_images: number;
  input_fidelity: "auto" | "high" | "low";
  /** gpt-image-* `quality`: trades cost/speed for fidelity. */
  quality: "auto" | "low" | "medium" | "high";
  /** gpt-image-* `output_format`: bundle file type. */
  output_format: "auto" | "png" | "jpeg" | "webp";
  /** gpt-image-* `output_compression`: 0–100, only meaningful for jpeg/webp. */
  output_compression: number;
  /** gpt-image-* `background`: transparent requires png or webp. */
  background: "auto" | "transparent" | "opaque";
  theme: "light" | "dark";
  /** When true, ignore `theme` and track the OS color scheme live —
   *  changes to system preference instantly mirror into the app. */
  follow_system_theme: boolean;
  backdrop: "mica" | "micaalt" | "acrylic" | "none";
  language: "system" | "zh-Hans" | "en-US";
  save_directory: string;
  /** When on (default), every successful generation/edit is auto-cached
   *  to `<app-data>/cache/images/` and indexed in history.json. Browsable
   *  from the History page. */
  auto_cache: boolean;
}

export const defaultConfig: AppConfig = {
  schema_version: CONFIG_SCHEMA_VERSION,
  endpoints: [],
  models: [],
  selected_gen_model_id: "",
  selected_edit_model_id: "",
  param_presets: [],
  selected_gen_param_source: "global",
  selected_edit_param_source: "global",
  default_aspect_ratio: "1:1",
  default_resolution: "1080p",
  advanced_size_mode: false,
  default_size: "1024x1024",
  google_aspect_ratio: "1:1",
  send_response_format: false,
  timeout_seconds: 180,
  verify_ssl: true,
  stream: true,
  partial_images: 2,
  input_fidelity: "auto",
  quality: "auto",
  output_format: "auto",
  output_compression: 90,
  background: "auto",
  theme: "light",
  follow_system_theme: true,
  backdrop: "mica",
  language: "system",
  save_directory: "",
  auto_cache: true,
};

/** Re-export so UI callers don't need to import presets.ts directly when
 *  they only want the Gemini default URL. */
export { DEFAULT_BASE_URL };

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
    cachedConfigPath = await join(await resourceDir(), "config.json");
  } else {
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
    const parsed = JSON.parse(text) as Partial<AppConfig> & Record<string, unknown>;

    // Pre-v2 schema reset: any config missing schema_version or with
    // version < 2 is from the single-endpoint era. User opted to wipe
    // on upgrade, so we reset and force the onboarding wizard.
    const v = typeof parsed.schema_version === "number" ? parsed.schema_version : 1;
    if (v < CONFIG_SCHEMA_VERSION) {
      const reset = { ...defaultConfig };
      await saveConfig(reset);
      return reset;
    }
    // Migrate legacy `theme: "system"` → follow_system_theme switch.
    // The type was tightened to "light" | "dark"; old saved configs may
    // still carry "system" which we fold into the new boolean flag.
    if ((parsed as { theme?: string }).theme === "system") {
      (parsed as { theme: string }).theme = "light";
      parsed.follow_system_theme = true;
    }
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
  const hasEndpoint = cfg.endpoints.some((e) => !!e.api_key.trim());
  const hasModel = cfg.models.length > 0;
  return hasEndpoint && hasModel;
}

export function normalizedBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Look up a model's endpoint. Returns null if either the model or its
 *  endpoint has been removed. */
export function resolveEndpoint(cfg: AppConfig, modelId: string): { model: ModelEntry; endpoint: Endpoint } | null {
  const model = cfg.models.find((m) => m.id === modelId);
  if (!model) return null;
  const endpoint = cfg.endpoints.find((e) => e.id === model.endpoint_id);
  if (!endpoint) return null;
  return { model, endpoint };
}

export function newId(): string {
  // Browser-native; available in all modern WebViews (Tauri 2 uses WebView2).
  return crypto.randomUUID();
}
