import { create } from "zustand";
import { persist } from "zustand/middleware";

export type HistoryPage = "generate" | "edit";

export interface PromptHistoryEntry {
  id: string;
  prompt: string;
  page: HistoryPage;
  ts: number;
}

interface HistoryStore {
  history: PromptHistoryEntry[];
  /** Push a new entry. Dedupes if the previous entry on the same page has the
   *  identical prompt, to avoid spamming on rapid resubmits. Caps at 50. */
  add: (prompt: string, page: HistoryPage) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const MAX_ENTRIES = 50;

function shortId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useHistory = create<HistoryStore>()(
  persist(
    (set, get) => ({
      history: [],
      add: (prompt, page) => {
        const trimmed = prompt.trim();
        if (!trimmed) return;
        const prev = get().history;
        if (prev[0]?.prompt === trimmed && prev[0]?.page === page) return;
        const next: PromptHistoryEntry = {
          id: shortId(),
          prompt: trimmed,
          page,
          ts: Date.now(),
        };
        set({ history: [next, ...prev].slice(0, MAX_ENTRIES) });
      },
      remove: (id) => set((s) => ({ history: s.history.filter((e) => e.id !== id) })),
      clear: () => set({ history: [] }),
    }),
    {
      name: "image-manager-prompt-history",
      version: 1,
    }
  )
);
