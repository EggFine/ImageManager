import { defineStore } from "pinia";
import {
  addEntry,
  clearAllEntries,
  loadHistory,
  removeEntry,
  type CacheEntry,
  type CachePage,
} from "@/services/imageCache";

interface State {
  entries: CacheEntry[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

export const useCacheStore = defineStore("cache", {
  state: (): State => ({
    entries: [],
    loaded: false,
    loading: false,
    error: null,
  }),
  actions: {
    /** Hydrate from disk. Idempotent — safe to call multiple times. */
    async init() {
      if (this.loaded || this.loading) return;
      this.loading = true;
      try {
        const list = await loadHistory();
        this.entries = list;
        this.loaded = true;
        this.loading = false;
        this.error = null;
      } catch (e) {
        this.loading = false;
        this.error = e instanceof Error ? e.message : String(e);
      }
    },

    /** Persist a freshly produced batch + push it onto the in-memory list. */
    async add(opts: {
      page: CachePage;
      prompt: string;
      model: string;
      size: string;
      results: Uint8Array[];
      outputFormat: string;
    }): Promise<CacheEntry | null> {
      try {
        const entry = await addEntry(opts);
        this.entries = [entry, ...this.entries];
        return entry;
      } catch (e) {
        console.error("Failed to cache generation", e);
        return null;
      }
    },

    /** Drop one entry from disk + memory. */
    async remove(id: string) {
      await removeEntry(id);
      this.entries = this.entries.filter((e) => e.id !== id);
    },

    /** Nuke the whole cache. */
    async clear() {
      await clearAllEntries();
      this.entries = [];
    },
  },
});
