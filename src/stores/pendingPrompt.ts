import { defineStore } from "pinia";

type Page = "generate" | "edit";

interface State {
  // Prompt-seeding (History → Generate / Edit "use this prompt" flow)
  prompt: string;
  promptPage: Page | null;
  // Image-seeding (Generate result → Edit "edit this image" flow)
  imagePaths: string[];
  imagesPage: Page | null;
}

/** Cross-view buffer for "use this …" handoffs. Two independent channels:
 *
 *  - **prompt** (History entry → Generate / Edit): the user clicks "use
 *    this prompt" on a history item, navigates to /generate or /edit,
 *    and the destination view consumes the prompt text on mount.
 *  - **images** (Generate result → Edit): the user clicks "edit this
 *    image" in the results panel, the bytes get written to a temp file,
 *    the path lands here, and EditView picks it up on mount.
 *
 *  Both channels are consume-once. The destination view drains them in
 *  `setup` so subsequent navigations don't replay the same value. */
export const usePendingPromptStore = defineStore("pendingPrompt", {
  state: (): State => ({
    prompt: "",
    promptPage: null,
    imagePaths: [],
    imagesPage: null,
  }),
  actions: {
    set(prompt: string, page: Page) {
      this.prompt = prompt;
      this.promptPage = page;
    },
    setImages(paths: string[], page: Page) {
      this.imagePaths = paths;
      this.imagesPage = page;
    },
    consume(page: Page): string | null {
      if (this.promptPage === page && this.prompt) {
        const p = this.prompt;
        this.prompt = "";
        this.promptPage = null;
        return p;
      }
      return null;
    },
    consumeImages(page: Page): string[] {
      if (this.imagesPage === page && this.imagePaths.length > 0) {
        const imgs = this.imagePaths;
        this.imagePaths = [];
        this.imagesPage = null;
        return imgs;
      }
      return [];
    },
  },
});
