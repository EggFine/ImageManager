import { defineStore } from "pinia";

interface State {
  prompt: string;
  page: "generate" | "edit" | null;
}

/** Cross-view buffer for "use this prompt" from History → Generate/Edit.
 *  The destination view calls `consume()` on mount to read + clear. */
export const usePendingPromptStore = defineStore("pendingPrompt", {
  state: (): State => ({ prompt: "", page: null }),
  actions: {
    set(prompt: string, page: "generate" | "edit") {
      this.prompt = prompt;
      this.page = page;
    },
    consume(page: "generate" | "edit"): string | null {
      if (this.page === page && this.prompt) {
        const p = this.prompt;
        this.prompt = "";
        this.page = null;
        return p;
      }
      return null;
    },
  },
});
