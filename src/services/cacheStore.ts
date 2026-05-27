import { create } from "zustand";
import {
  addEntry,
  clearAllEntries,
  loadHistory,
  removeEntry,
  type CacheEntry,
  type CachePage,
} from "./imageCache";

interface CacheStore {
  entries: CacheEntry[];
  loaded: boolean;
  loading: boolean;
  error: string | null;

  /** Hydrate from disk. Idempotent — safe to call multiple times. */
  init: () => Promise<void>;

  /** Persist a freshly produced batch + push it onto the in-memory list. */
  add: (opts: {
    page: CachePage;
    prompt: string;
    model: string;
    size: string;
    results: Uint8Array[];
    outputFormat: string;
  }) => Promise<CacheEntry | null>;

  /** Drop one entry from disk + memory. */
  remove: (id: string) => Promise<void>;

  /** Nuke the whole cache. */
  clear: () => Promise<void>;
}

export const useImageCache = create<CacheStore>((set, get) => ({
  entries: [],
  loaded: false,
  loading: false,
  error: null,

  init: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const list = await loadHistory();
      set({ entries: list, loaded: true, loading: false, error: null });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  add: async (opts) => {
    try {
      const entry = await addEntry(opts);
      set((s) => ({ entries: [entry, ...s.entries] }));
      return entry;
    } catch (e) {
      console.error("Failed to cache generation", e);
      return null;
    }
  },

  remove: async (id) => {
    await removeEntry(id);
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
  },

  clear: async () => {
    await clearAllEntries();
    set({ entries: [] });
  },
}));
