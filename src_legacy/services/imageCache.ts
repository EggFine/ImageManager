import {
  exists,
  mkdir,
  readFile,
  writeFile,
  remove,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { join, appConfigDir, resourceDir } from "@tauri-apps/api/path";
import { platform } from "@tauri-apps/plugin-os";

export type CachePage = "generate" | "edit";

export interface CacheEntry {
  id: string;
  page: CachePage;
  prompt: string;
  model: string;
  size: string;
  /** Filenames inside `cache/images/`, newest result first within the batch. */
  files: string[];
  /** Wall-clock at the moment the batch finished. */
  timestamp: number;
  /** Resolved output format extension actually written to disk. */
  ext: "png" | "jpeg" | "webp";
}

/* ─── Paths ──────────────────────────────────────────────────────────── */

let cachedRoot: string | null = null;

/**
 * Cache root sits inside the same "where the app keeps its stuff" dir as
 * `config.json` — `<exe_dir>/cache` on Windows portable mode, otherwise in
 * the standard appConfigDir. Same scope as the config file, so no extra
 * Tauri capability work needed.
 */
export async function getCacheRoot(): Promise<string> {
  if (cachedRoot) return cachedRoot;
  const base = platform() === "windows" ? await resourceDir() : await appConfigDir();
  const root = await join(base, "cache");
  if (!(await exists(root))) await mkdir(root, { recursive: true });
  cachedRoot = root;
  return root;
}

async function getImagesDir(): Promise<string> {
  const root = await getCacheRoot();
  const dir = await join(root, "images");
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  return dir;
}

async function getHistoryPath(): Promise<string> {
  const root = await getCacheRoot();
  return join(root, "history.json");
}

function shortId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 12);
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function extFromConfigFormat(fmt: string | undefined): "png" | "jpeg" | "webp" {
  if (fmt === "jpeg" || fmt === "webp") return fmt;
  // auto / png / anything else → png (the API's default for gpt-image-*)
  return "png";
}

/* ─── History.json ────────────────────────────────────────────────────── */

export async function loadHistory(): Promise<CacheEntry[]> {
  const path = await getHistoryPath();
  if (!(await exists(path))) return [];
  try {
    const text = await readTextFile(path);
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as CacheEntry[];
    return [];
  } catch (e) {
    console.error("history.json parse failed", e);
    return [];
  }
}

async function saveHistory(entries: CacheEntry[]): Promise<void> {
  const path = await getHistoryPath();
  await writeTextFile(path, JSON.stringify(entries, null, 2));
}

/* ─── Mutations ──────────────────────────────────────────────────────── */

interface AddOptions {
  page: CachePage;
  prompt: string;
  model: string;
  size: string;
  /** Stream of raw image bytes — one element per result image. */
  results: Uint8Array[];
  /** What format the bytes are in (from cfg.output_format). */
  outputFormat: string;
}

export async function addEntry(opts: AddOptions): Promise<CacheEntry> {
  const ext = extFromConfigFormat(opts.outputFormat);
  const imagesDir = await getImagesDir();
  const id = shortId();

  const files: string[] = [];
  for (let i = 0; i < opts.results.length; i++) {
    const filename = `${id}-${String(i + 1).padStart(2, "0")}.${ext}`;
    const filePath = await join(imagesDir, filename);
    await writeFile(filePath, opts.results[i]);
    files.push(filename);
  }

  const entry: CacheEntry = {
    id,
    page: opts.page,
    prompt: opts.prompt,
    model: opts.model,
    size: opts.size,
    files,
    timestamp: Date.now(),
    ext,
  };

  const existing = await loadHistory();
  existing.unshift(entry);
  await saveHistory(existing);
  return entry;
}

export async function readEntryImage(filename: string): Promise<Uint8Array> {
  const dir = await getImagesDir();
  const path = await join(dir, filename);
  return await readFile(path);
}

export async function removeEntry(id: string): Promise<void> {
  const entries = await loadHistory();
  const target = entries.find((e) => e.id === id);
  if (!target) return;

  const imagesDir = await getImagesDir();
  for (const filename of target.files) {
    try {
      await remove(await join(imagesDir, filename));
    } catch (e) {
      console.warn("Failed to delete cache file", filename, e);
    }
  }
  await saveHistory(entries.filter((e) => e.id !== id));
}

export async function clearAllEntries(): Promise<void> {
  const entries = await loadHistory();
  const imagesDir = await getImagesDir();
  for (const entry of entries) {
    for (const filename of entry.files) {
      try {
        await remove(await join(imagesDir, filename));
      } catch {
        /* ignore */
      }
    }
  }
  await saveHistory([]);
}

/* ─── Aggregate stats (for "X cached, Y MB" UI affordances) ──────────── */

export interface CacheStats {
  entryCount: number;
  imageCount: number;
}

export function statsOf(entries: CacheEntry[]): CacheStats {
  return {
    entryCount: entries.length,
    imageCount: entries.reduce((sum, e) => sum + e.files.length, 0),
  };
}
