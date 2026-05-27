import { defineStore } from "pinia";

export type HistoryPage = "generate" | "edit";

export interface PromptHistoryEntry {
  id: string;
  prompt: string;
  page: HistoryPage;
  ts: number;
}

interface State {
  history: PromptHistoryEntry[];
  /** Lazy-load flag so we only read localStorage once per session. */
  _hydrated: boolean;
}

const MAX_ENTRIES = 50;
const STORAGE_KEY = "image-manager-prompt-history";

function shortId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadFromLS(): PromptHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.history)) return parsed.history;
    return [];
  } catch {
    return [];
  }
}

function saveToLS(history: PromptHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ history, version: 1 }));
  } catch {
    /* localStorage full / disabled — ignore */
  }
}

export const useHistoryStore = defineStore("history", {
  state: (): State => ({
    history: [],
    _hydrated: false,
  }),
  actions: {
    /** Idempotent — call from page mount or app boot. */
    hydrate() {
      if (this._hydrated) return;
      this.history = loadFromLS();
      this._hydrated = true;
    },

    add(prompt: string, page: HistoryPage) {
      const trimmed = prompt.trim();
      if (!trimmed) return;
      this.hydrate();
      if (this.history[0]?.prompt === trimmed && this.history[0]?.page === page) return;
      const entry: PromptHistoryEntry = {
        id: shortId(),
        prompt: trimmed,
        page,
        ts: Date.now(),
      };
      this.history = [entry, ...this.history].slice(0, MAX_ENTRIES);
      saveToLS(this.history);
    },

    remove(id: string) {
      this.history = this.history.filter((e) => e.id !== id);
      saveToLS(this.history);
    },

    clear() {
      this.history = [];
      saveToLS(this.history);
    },
  },
});
