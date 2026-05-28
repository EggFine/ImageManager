import { defineStore } from "pinia";
import type { ImageResult, PartialImage } from "@/services/apiClient";
import { readEntryImage, type CacheEntry } from "@/services/imageCache";

export type TaskKind = "generate" | "edit";
export type TaskStatus = "running" | "done" | "error";

/** A submitted generation/edit, lifted out of the view so it survives
 *  route changes. Pinia keeps this state alive as long as the app is
 *  open — when the user navigates away mid-generation the underlying
 *  fetch keeps running and writes its partial/final results here. */
export interface RunningTask {
  id: string;
  kind: TaskKind;
  prompt: string;
  modelId: string;
  modelLabel: string;
  size: string;
  n: number;
  /** Edit-only: the source image paths the request was submitted with.
   *  Stored so the Edit view can repopulate its form when the user
   *  navigates back. Empty array for `generate` tasks. */
  imagePaths: string[];
  startedAt: number;
  status: TaskStatus;
  partial: PartialImage | null;
  results: ImageResult[];
  error?: string;
}

interface State {
  tasks: RunningTask[];
}

export const useTasksStore = defineStore("tasks", {
  state: (): State => ({ tasks: [] }),
  getters: {
    /** Every task currently in flight, oldest first. */
    running: (s): RunningTask[] => s.tasks.filter((t) => t.status === "running"),
    /** Most recent task of a given kind regardless of status. The view
     *  uses this to drive ResultsView (a running task shows partials, a
     *  done task shows the final results, an errored task shows the
     *  failure). */
    latestByKind:
      (s) =>
      (kind: TaskKind): RunningTask | null => {
        for (let i = s.tasks.length - 1; i >= 0; i--) {
          if (s.tasks[i].kind === kind) return s.tasks[i];
        }
        return null;
      },
  },
  actions: {
    start(
      init: Omit<RunningTask, "id" | "startedAt" | "status" | "partial" | "results" | "imagePaths"> & {
        imagePaths?: string[];
      }
    ): string {
      // Replace any previous done/error task of the same kind. Running
      // tasks (e.g. user fired a second submit while one is still going)
      // stay — both will show in the sidebar.
      this.tasks = this.tasks.filter(
        (t) => !(t.kind === init.kind && t.status !== "running")
      );
      const id = crypto.randomUUID();
      this.tasks.push({
        id,
        kind: init.kind,
        prompt: init.prompt,
        modelId: init.modelId,
        modelLabel: init.modelLabel,
        size: init.size,
        n: init.n,
        imagePaths: init.imagePaths ?? [],
        startedAt: Date.now(),
        status: "running",
        partial: null,
        results: [],
      });
      return id;
    },
    setPartial(id: string, partial: PartialImage) {
      const t = this.tasks.find((x) => x.id === id);
      if (t) t.partial = partial;
    },
    finish(id: string, results: ImageResult[]) {
      const t = this.tasks.find((x) => x.id === id);
      if (t) {
        t.results = results;
        t.partial = null;
        t.status = "done";
      }
    },
    fail(id: string, error: string) {
      const t = this.tasks.find((x) => x.id === id);
      if (t) {
        t.status = "error";
        t.error = error;
        t.partial = null;
      }
    },
    remove(id: string) {
      this.tasks = this.tasks.filter((t) => t.id !== id);
    },

    /** Rehydrate a finished cache entry back into the store as a `done`
     *  task so the user can view it inside the /create result mode (not
     *  the standalone history detail). Reads the entry's image files
     *  from disk to populate `results`. Idempotent — if a task with the
     *  same id already exists, it's replaced. The task takes the cache
     *  entry's id so the URL `?task=<id>` matches both. */
    async hydrateFromCache(entry: CacheEntry): Promise<string> {
      const existing = this.tasks.find((t) => t.id === entry.id);
      if (existing) return existing.id;

      const bytesList: Uint8Array[] = [];
      for (const filename of entry.files) {
        try {
          const b = await readEntryImage(filename);
          bytesList.push(b);
        } catch (e) {
          console.warn("hydrateFromCache: missing file", filename, e);
        }
      }
      const results: ImageResult[] = bytesList.map((bytes) => ({ bytes }));

      this.tasks.push({
        id: entry.id,
        kind: entry.page,
        prompt: entry.prompt,
        modelId: entry.model,
        modelLabel: entry.model,
        size: entry.size,
        n: entry.files.length,
        imagePaths: [],
        startedAt: entry.timestamp,
        status: "done",
        partial: null,
        results,
      });
      return entry.id;
    },
  },
});
