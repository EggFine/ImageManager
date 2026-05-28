<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useToast } from "@nuxt/ui/composables";
import { useRoute, useRouter } from "vue-router";
import { gsap } from "gsap";
import { useConfigStore } from "@/stores/config";
import { useCacheStore } from "@/stores/cache";
import { useHistoryStore } from "@/stores/history";
import { usePendingPromptStore } from "@/stores/pendingPrompt";
import { useTasksStore } from "@/stores/tasks";
import { ApiError, edit, editStream, generate, generateStream } from "@/services/apiClient";
import { computeSize } from "@/services/sizeCalc";
import { isConfigured, resolveEndpoint } from "@/services/config";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { exists, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { join, tempDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  defaultsFromConfig,
  resolveOverrides,
  type TaskOverrides,
} from "@/composables/paramOverrides";
import ParamSourceHeader from "@/components/ParamSourceHeader.vue";
import ParamFieldsCard from "@/components/ParamFieldsCard.vue";
import SizeSelector from "@/components/SizeSelector.vue";
import ResultsView from "@/components/ResultsView.vue";
import { useEnterAnimation } from "@/composables/useEnterAnimation";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const root = ref<HTMLElement | null>(null);
useEnterAnimation(root);
const cfg = useConfigStore();
const cache = useCacheStore();
const historyStore = useHistoryStore();
const pendingPrompt = usePendingPromptStore();
const tasks = useTasksStore();
const toast = useToast();

// Which task (if any) the user is currently viewing. Driven by the URL
// query `?task=<id>` — the sidebar "running" / "recent" chips push
// with this query, while the main "文生图" nav links to /generate
// without it. That means clicking the main nav is always a fresh form,
// while sidebar chips bring you back to the task in question.
const currentTask = computed(() => {
  const id = route.query.task;
  if (typeof id !== "string") return null;
  return tasks.tasks.find((t) => t.id === id) ?? null;
});
const busy = computed(() => currentTask.value?.status === "running");
const results = computed(() => currentTask.value?.results ?? []);
const partial = computed(() => currentTask.value?.partial ?? null);

const SUPPORTED_EXT = /\.(png|jpe?g|webp)$/i;

const incoming = pendingPrompt.consume("generate") ?? pendingPrompt.consume("edit");
const incomingImages = pendingPrompt.consumeImages("edit");
// Seed the prompt input: explicit handoff (pendingPrompt) wins; then
// the task being viewed (if any); then "" — we no longer auto-restore
// from "last running of kind" because that would re-populate the form
// on plain main-nav clicks, which the user wants to be fresh.
const prompt = ref(incoming ?? currentTask.value?.prompt ?? "");
const n = ref(currentTask.value?.n ?? 1);
const customOverrides = ref<TaskOverrides>(defaultsFromConfig(cfg.config));

// Reference images. Adding ≥1 image flips the submit from
// /images/generations to /images/edits at request time. The view is
// otherwise the same UI either way.
const imagePaths = ref<string[]>(
  incomingImages.length > 0
    ? incomingImages
    : currentTask.value?.imagePaths.slice() ?? []
);
const maskPath = ref("");
const dragHover = ref(false);

const isEditMode = computed(() => imagePaths.value.length > 0);

// ─── View-mode state machine ───
// Three discrete stages (no upload step — generate doesn't take input
// images). Mode is derived purely from data; "result → form" is a
// manual action that removes the done task so the mode recomputes.
type ViewMode = "form" | "generating" | "result";
const mode = computed<ViewMode>(() => {
  if (currentTask.value?.status === "running") return "generating";
  if (currentTask.value?.status === "done") return "result";
  return "form";
});

function backToForm() {
  // Preserve prompt + images across the navigation so the user can
  // tweak and resubmit; without this the new mount would arrive empty.
  if (currentTask.value) {
    if (currentTask.value.prompt) {
      pendingPrompt.set(currentTask.value.prompt, "generate");
    }
    if (currentTask.value.imagePaths.length > 0) {
      pendingPrompt.setImages(currentTask.value.imagePaths.slice(), "edit");
    }
  }
  if (currentTask.value && currentTask.value.status !== "running") {
    tasks.remove(currentTask.value.id);
  }
  void router.replace({ path: "/create" });
}

// Blob URL for the streaming partial preview shown in generating mode.
const partialUrl = ref<string | null>(null);
watch(
  partial,
  (p) => {
    if (partialUrl.value) URL.revokeObjectURL(partialUrl.value);
    partialUrl.value = p
      ? URL.createObjectURL(new Blob([new Uint8Array(p.bytes)], { type: "image/png" }))
      : null;
  },
  { immediate: true }
);
onBeforeUnmount(() => {
  if (partialUrl.value) URL.revokeObjectURL(partialUrl.value);
});

// Recent prompts across BOTH generate and edit history — unified view
// means unified suggestions. Top 5, de-duped by string.
const recentPrompts = computed(() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of historyStore.history) {
    if (seen.has(e.prompt)) continue;
    seen.add(e.prompt);
    out.push(e.prompt);
    if (out.length >= 5) break;
  }
  return out;
});

// Elapsed seconds for the generating-mode meta. Live-updates via a
// 1Hz interval that only ticks while a task is running.
const elapsedSec = ref(0);
let elapsedTimer: number | null = null;
watch(
  () => currentTask.value?.status,
  (status) => {
    if (elapsedTimer !== null) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
    if (status === "running" && currentTask.value) {
      const started = currentTask.value.startedAt;
      const tick = () => {
        elapsedSec.value = Math.floor((Date.now() - started) / 1000);
      };
      tick();
      elapsedTimer = window.setInterval(tick, 1000);
    } else {
      elapsedSec.value = 0;
    }
  },
  { immediate: true }
);
onBeforeUnmount(() => {
  if (elapsedTimer !== null) clearInterval(elapsedTimer);
});

// ─── Animated background blobs (form mode) ───
// Four soft colored gradients drift around behind the hero / prompt
// card to give the empty state visual life. The animation respects
// `prefers-reduced-motion` (skip entirely) and is scoped to the
// background container so cleanup is automatic on unmount.
const bgRoot = ref<HTMLElement | null>(null);
let bgCtx: gsap.Context | undefined;

function startBgAnimation() {
  if (!bgRoot.value) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  bgCtx?.revert();
  bgCtx = gsap.context(() => {
    const blobs = bgRoot.value!.querySelectorAll<HTMLElement>("[data-blob]");
    blobs.forEach((blob, i) => {
      // Random walk: each repeat starts from the CURRENT position and
      // animates to a new random destination (repeatRefresh resets the
      // start values). No yoyo — that was making the blobs average out
      // to their origin and look anchored.
      //
      // Translate range is wide enough that the motion reads from
      // across the page; rotation adds shape variation since the
      // gradient isn't perfectly circular at every blur level.
      gsap.to(blob, {
        x: "random(-260, 260)",
        y: "random(-180, 180)",
        scale: "random(0.7, 1.35)",
        rotation: "random(-120, 120)",
        duration: 7 + i * 0.9,
        ease: "sine.inOut",
        repeat: -1,
        repeatRefresh: true,
      });
      // Independent slower opacity pulse for a subtle "breathing" feel —
      // different period from the walk so the two don't sync visually.
      gsap.to(blob, {
        opacity: "random(0.35, 0.6)",
        duration: 5 + i * 0.7,
        ease: "sine.inOut",
        repeat: -1,
        repeatRefresh: true,
      });
    });
  }, bgRoot.value);
}

// Restart the blob animation whenever the view returns to form mode
// (e.g., after a generation completes and the user clicks back).
watch(
  mode,
  (m) => {
    if (m === "form") {
      // Wait one tick so the freshly-mounted bg DOM is in place.
      void nextTickStart();
    } else {
      bgCtx?.revert();
      bgCtx = undefined;
    }
  },
  { immediate: true }
);

async function nextTickStart() {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  startBgAnimation();
}

onUnmounted(() => {
  bgCtx?.revert();
});

// Model + param-source selection toggles between the gen/edit fields
// based on `isEditMode`, so users with different preferences per mode
// (e.g., gpt-image-2 for gen, gpt-image-1 for edit) keep both. The
// underlying config fields stay split.
const selectedModelField = computed(() =>
  isEditMode.value ? "selected_edit_model_id" : "selected_gen_model_id"
);
const selectedSourceField = computed(() =>
  isEditMode.value ? "selected_edit_param_source" : "selected_gen_param_source"
);

const selectedModelId = computed(() => {
  const id = cfg.config[selectedModelField.value];
  if (id && cfg.config.models.some((m) => m.id === id)) return id;
  return cfg.config.models[0]?.id ?? "";
});

const resolved = computed(() =>
  selectedModelId.value ? resolveEndpoint(cfg.config, selectedModelId.value) : null
);
const isGoogle = computed(() => resolved.value?.endpoint.type === "google");

const paramSource = computed(() => cfg.config[selectedSourceField.value] || "global");

const effectiveOverrides = computed(() =>
  resolveOverrides(cfg.config, paramSource.value, customOverrides.value)
);

const modelOptions = computed(() =>
  cfg.config.models.map((m) => ({ label: m.label, value: m.id }))
);

function handleSelectModel(id: string) {
  void cfg.update({ [selectedModelField.value]: id });
}

function handleSourceChange(next: string) {
  if (next === "custom") {
    customOverrides.value = resolveOverrides(cfg.config, paramSource.value, customOverrides.value);
  }
  void cfg.update({ [selectedSourceField.value]: next });
}

function handleSizeChange(next: { aspectRatio: string; resolution: string; advanced: boolean; advancedText: string }) {
  if (paramSource.value === "global") {
    void cfg.update({
      default_aspect_ratio: next.aspectRatio,
      default_resolution: next.resolution,
      advanced_size_mode: next.advanced,
      default_size: next.advancedText,
    });
  } else if (paramSource.value === "custom") {
    customOverrides.value = {
      ...customOverrides.value,
      aspect_ratio: next.aspectRatio,
      resolution: next.resolution,
      advanced_size_mode: next.advanced,
      size: next.advancedText,
    };
  } else {
    void cfg.updatePreset(paramSource.value, {
      aspect_ratio: next.aspectRatio,
      resolution: next.resolution,
      advanced_size_mode: next.advanced,
      size: next.advancedText,
    });
  }
}

async function submit() {
  if (!isConfigured(cfg.config) || !resolved.value) {
    toast.add({
      title: t("dialog.missingKeyTitle"),
      description: t("dialog.missingKeyBody"),
      color: "warning",
    });
    return;
  }
  // Edit mode requires every referenced file to still exist on disk —
  // catches the case where the user dragged in a path then moved/deleted
  // the file before submitting.
  if (isEditMode.value) {
    for (const p of imagePaths.value) {
      if (!(await exists(p))) {
        toast.add({
          title: t("dialog.invalidImageTitle"),
          description: p,
          color: "warning",
        });
        return;
      }
    }
  }
  const p = prompt.value.trim();
  if (!p) {
    toast.add({
      title: t("dialog.missingPromptTitle"),
      description: isEditMode.value
        ? t("dialog.missingEditPromptBody")
        : t("dialog.missingPromptBody"),
      color: "warning",
    });
    return;
  }

  cfg.setStatus(
    isEditMode.value ? t("status.processing") : t("status.generating")
  );
  // The history page still differentiates "generate" vs "edit" entries
  // (different model defaults / param presets), so we tag history with
  // the inferred kind at submit time.
  const taskKind = isEditMode.value ? "edit" : "generate";
  historyStore.add(p, taskKind);

  const overrides = resolveOverrides(cfg.config, paramSource.value, customOverrides.value);
  const size = overrides.advanced_size_mode
    ? overrides.size
    : computeSize(overrides.aspect_ratio, overrides.resolution);
  const effectiveCfg = { ...cfg.config, ...overrides };
  const mask = isGoogle.value ? null : maskPath.value || null;

  // Register the task in the global store. From now on partial frames
  // and final results land here — the view's display refs are
  // computed off the store, so they keep updating even after we leave
  // this view.
  const taskId = tasks.start({
    kind: taskKind,
    prompt: p,
    modelId: resolved.value.model.model_id,
    modelLabel: resolved.value.model.label,
    size,
    n: n.value,
    imagePaths: imagePaths.value.slice(),
  });
  // Switch the URL to view this new task. View remounts in generating
  // mode; the fetch (below) continues in this closure regardless,
  // writing progress into the store which the new mount observes.
  if (route.query.task !== taskId) {
    void router.replace({ path: "/create", query: { task: taskId } });
  }

  try {
    const useStream = cfg.config.stream && n.value === 1;
    let imgs;
    if (isEditMode.value) {
      imgs = useStream
        ? await editStream(
            resolved.value.endpoint,
            resolved.value.model.model_id,
            effectiveCfg,
            imagePaths.value,
            mask,
            p,
            size,
            n.value,
            (pi) => tasks.setPartial(taskId, pi)
          )
        : await edit(
            resolved.value.endpoint,
            resolved.value.model.model_id,
            effectiveCfg,
            imagePaths.value,
            mask,
            p,
            size,
            n.value
          );
    } else {
      imgs = useStream
        ? await generateStream(
            resolved.value.endpoint,
            resolved.value.model.model_id,
            effectiveCfg,
            p,
            size,
            n.value,
            (pi) => tasks.setPartial(taskId, pi)
          )
        : await generate(
            resolved.value.endpoint,
            resolved.value.model.model_id,
            effectiveCfg,
            p,
            size,
            n.value
          );
    }
    tasks.finish(taskId, imgs);
    cfg.setStatus(t("status.success", { count: imgs.length }));

    // Cache the batch and surface a toast with a deep link to the detail
    // page — without this the user has no obvious way to find the images
    // again after navigating off the Generate page.
    if (cfg.config.auto_cache && imgs.length > 0) {
      const entry = await cache.add({
        page: taskKind,
        prompt: p,
        model: resolved.value.model.model_id,
        size,
        results: imgs.map((r) => r.bytes),
        outputFormat: effectiveCfg.output_format,
      });
      toast.add({
        title: t("status.success", { count: imgs.length }),
        description: t("dialog.savedToHistory"),
        color: "success",
        icon: "i-lucide-check",
        actions: entry
          ? [
              {
                label: t("dialog.viewDetail"),
                color: "primary",
                variant: "link",
                onClick: () => {
                  void router.push(`/history/${entry.id}`);
                },
              },
            ]
          : undefined,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    tasks.fail(taskId, msg);
    const title =
      e instanceof ApiError ? t("dialog.requestFailedTitle") : t("dialog.exceptionTitle");
    toast.add({ title, description: msg, color: "error" });
    cfg.setStatus("");
  }
}

function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !busy.value) {
    e.preventDefault();
    void submit();
  }
}

// ─── Reference images (optional inputs) ───
// imagePaths drives both the inline thumbnail strip and the
// generate-vs-edit decision at submit time. Three entry points: paperclip
// file picker, Ctrl+V global paste, OS drag-drop onto the window.

function addImage(path: string) {
  imagePaths.value = [...imagePaths.value, path];
}
function removeImage(idx: number) {
  imagePaths.value = imagePaths.value.filter((_, i) => i !== idx);
}

async function pickSource() {
  const picked = await openDialog({
    filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] }],
    multiple: true,
  });
  if (Array.isArray(picked)) {
    for (const p of picked) addImage(p);
  } else if (typeof picked === "string") {
    addImage(picked);
  }
}

// Clipboard → temp file → imagePaths. Used by both the explicit paste
// button and the global Ctrl+V handler. The temp file lives in $TEMP
// (already in fs scope) and is left for the OS to reap.
async function addImageFromBlob(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = blob.type || "image/png";
  const ext = mime.split("/")[1]?.split("+")[0] || "png";
  const tmp = await tempDir();
  const filename = `imagemanager-paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const fullPath = await join(tmp, filename);
  await writeFile(fullPath, bytes);
  addImage(fullPath);
  toast.add({ title: t("edit.clipboardPasted"), color: "success", icon: "i-lucide-check" });
}

function onPaste(e: ClipboardEvent) {
  if (!e.clipboardData) return;
  // Check the clipboard FIRST, regardless of focus target. If there's
  // an image, intercept and attach it — even when the user pressed
  // Ctrl+V inside the prompt textarea (which is the natural place to
  // paste from). Otherwise we don't preventDefault, so plain text
  // pastes still fall through to native behavior on input/textarea.
  const imageItem = Array.from(e.clipboardData.items).find(
    (it) => it.kind === "file" && it.type.startsWith("image/")
  );
  if (!imageItem) return;
  e.preventDefault();
  const blob = imageItem.getAsFile();
  if (blob) void addImageFromBlob(blob);
}

// OS drag-drop: any supported image dropped onto the window appends.
let unlistenDnd: (() => void) | undefined;
onMounted(async () => {
  unlistenDnd = await getCurrentWindow().onDragDropEvent((event) => {
    const payload = event.payload as
      | { type: "enter" | "over"; paths?: string[] }
      | { type: "drop"; paths: string[] }
      | { type: "leave" };
    if (payload.type === "enter" || payload.type === "over") dragHover.value = true;
    else if (payload.type === "leave") dragHover.value = false;
    else if (payload.type === "drop") {
      dragHover.value = false;
      const valid = payload.paths?.filter((p) => SUPPORTED_EXT.test(p)) ?? [];
      if (valid.length > 0) {
        imagePaths.value = [...imagePaths.value, ...valid];
      } else if (payload.paths?.length) {
        toast.add({
          title: t("dialog.invalidImageTitle"),
          description: t("dnd.invalidFormat"),
          color: "warning",
        });
      }
    }
  });
  window.addEventListener("paste", onPaste);
});

// Blob URLs for inline thumbs. Replaces on imagePaths change; revokes
// removed entries and finally on unmount.
function mimeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}
const sourceThumbs = ref<Record<string, string>>({});
watch(
  imagePaths,
  async (paths) => {
    const next: Record<string, string> = {};
    for (const path of paths) {
      if (sourceThumbs.value[path]) {
        next[path] = sourceThumbs.value[path];
        continue;
      }
      try {
        const bytes = await readFile(path);
        next[path] = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: mimeFor(path) })
        );
      } catch (e) {
        console.warn("source thumb load failed", path, e);
      }
    }
    for (const [path, url] of Object.entries(sourceThumbs.value)) {
      if (!next[path]) URL.revokeObjectURL(url);
    }
    sourceThumbs.value = next;
  },
  { deep: true, immediate: true }
);

onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("paste", onPaste);
  unlistenDnd?.();
  for (const url of Object.values(sourceThumbs.value)) URL.revokeObjectURL(url);
});
</script>

<template>
  <div ref="root" class="h-full flex flex-col relative">
    <!-- Global drag-drop overlay — active in any mode. Dropping an image
         appends to imagePaths, switching the submit to edit semantics. -->
    <div
      v-if="dragHover"
      class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-primary/15 backdrop-blur-sm rounded-md border-2 border-dashed border-primary"
      aria-hidden
    >
      <div class="flex flex-col items-center gap-3 text-primary">
        <UIcon name="i-lucide-image-down" class="size-12" />
        <span class="italic text-lg">{{ t("dnd.dropToReplaceSource") }}</span>
      </div>
    </div>

    <!-- ── Form mode ─────────────────────────────────────────── -->
    <div
      v-if="mode === 'form'"
      v-anim
      class="relative flex-1 flex flex-col items-center justify-center gap-7 px-2 py-6"
    >
      <!-- Animated gradient blobs drifting behind everything. GSAP
           handles the motion (see startBgAnimation); CSS just sets
           position/color/blur. Decorative only, pointer-events: none.
           Container is pulled out 100px on both sides so the blur halo
           covers main's lg:px-10 padding gutter — without this, blobs
           drifting near the edge get clipped at the form div's bounds
           and produce a visible vertical line. Main has overflow-x-hidden
           so the negative offsets don't introduce a horizontal scroll. -->
      <div
        ref="bgRoot"
        class="absolute pointer-events-none"
        style="top: 0; bottom: 0; left: -100px; right: -100px;"
        aria-hidden
      >
        <div
          data-blob
          class="absolute rounded-full opacity-50 mix-blend-multiply dark:mix-blend-screen"
          style="
            top: 8%; left: 10%; width: 420px; height: 420px;
            background: radial-gradient(circle, rgb(244 114 182 / 0.55) 0%, transparent 70%);
            filter: blur(64px);
          "
        />
        <div
          data-blob
          class="absolute rounded-full opacity-50 mix-blend-multiply dark:mix-blend-screen"
          style="
            top: 20%; right: 8%; width: 380px; height: 380px;
            background: radial-gradient(circle, rgb(168 85 247 / 0.5) 0%, transparent 70%);
            filter: blur(64px);
          "
        />
        <div
          data-blob
          class="absolute rounded-full opacity-50 mix-blend-multiply dark:mix-blend-screen"
          style="
            bottom: 15%; left: 22%; width: 460px; height: 460px;
            background: radial-gradient(circle, rgb(34 211 238 / 0.45) 0%, transparent 70%);
            filter: blur(72px);
          "
        />
        <div
          data-blob
          class="absolute rounded-full opacity-45 mix-blend-multiply dark:mix-blend-screen"
          style="
            bottom: 10%; right: 18%; width: 360px; height: 360px;
            background: radial-gradient(circle, rgb(251 146 60 / 0.5) 0%, transparent 70%);
            filter: blur(64px);
          "
        />
      </div>

      <!-- Hero — centered, generous, slightly oversized. -->
      <div class="relative text-center max-w-3xl px-4">
        <h1 class="font-semibold tracking-tight text-highlighted text-3xl md:text-4xl leading-tight">
          Hey
          <span
            class="inline-flex items-center justify-center align-middle w-11 h-11 md:w-12 md:h-12 rounded-full bg-primary/15 mx-1"
          >
            <UIcon name="i-lucide-sparkles" class="size-5 md:size-6 text-primary" />
          </span>
          {{ t("gen.heroTitle") }}
        </h1>
        <p class="text-sm md:text-base text-muted mt-3 leading-relaxed">
          {{ t("gen.heroSubtitle") }}
        </p>
      </div>

      <!-- Prompt card — frosted-glass surface. The colored blob backdrop
           reads through the card via `backdrop-blur-2xl` (heavy blur of
           whatever's behind) + `backdrop-saturate-150` (boosts the
           bleed-through colors). Lower bg alpha lets more through; the
           `before:` ring renders a subtle top-edge "light catch" that
           sells the glass effect across both themes. -->
      <div
        class="relative w-full max-w-3xl rounded-3xl
               border border-default/70
               bg-default/45
               backdrop-blur-2xl backdrop-saturate-150
               shadow-xl
               before:pointer-events-none before:absolute before:inset-0 before:rounded-3xl
               before:bg-gradient-to-b before:from-white/15 before:to-transparent
               dark:before:from-white/10 dark:before:to-transparent
               focus-within:border-primary/50 transition"
      >
        <!-- Reference-image strip. Renders only when there's at least
             one image; the paperclip button below is the always-visible
             entry point for adding the first one. -->
        <div
          v-if="imagePaths.length > 0"
          class="flex items-center gap-2 px-4 pt-4 overflow-x-auto"
        >
          <div
            v-for="(path, i) in imagePaths"
            :key="path + i"
            class="relative w-16 h-16 rounded-lg overflow-hidden border border-default bg-elevated shrink-0 group"
          >
            <img
              v-if="sourceThumbs[path]"
              :src="sourceThumbs[path]"
              alt=""
              class="size-full object-cover"
              draggable="false"
            />
            <button
              type="button"
              class="absolute top-0.5 right-0.5 size-4 rounded-full bg-inverted/80 text-inverted flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              :aria-label="t('common.clear')"
              @click="removeImage(i)"
            >
              <UIcon name="i-lucide-x" class="size-2.5" />
            </button>
          </div>
          <button
            type="button"
            class="w-16 h-16 rounded-lg border border-dashed border-default flex items-center justify-center text-toned hover:border-primary hover:text-primary transition shrink-0"
            :aria-label="t('edit.addImage')"
            :title="t('edit.addImage')"
            @click="pickSource"
          >
            <UIcon name="i-lucide-plus" class="size-4" />
          </button>
        </div>

        <UTextarea
          v-model="prompt"
          :placeholder="
            imagePaths.length > 0
              ? t('edit.promptPlaceholder')
              : t('gen.promptPlaceholder')
          "
          autoresize
          :rows="3"
          variant="none"
          :ui="{ base: 'resize-none bg-transparent' }"
          class="w-full px-5 pt-4 pb-2 text-[15px]"
        />
        <div class="flex items-center justify-between gap-2 px-3 pb-3 flex-wrap">
          <div class="flex gap-1.5 items-center flex-wrap">
            <!-- Paperclip — primary entry point for adding the first
                 reference image. Once images exist, the strip above
                 also has a trailing "+" button. -->
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-paperclip"
              :aria-label="t('edit.addImage')"
              :title="t('edit.addImage')"
              @click="pickSource"
            />
            <USelect
              :model-value="selectedModelId"
              :items="modelOptions"
              :disabled="cfg.config.models.length === 0"
              size="sm"
              variant="ghost"
              class="w-auto"
              @update:model-value="handleSelectModel"
            />
            <UPopover v-if="!isGoogle">
              <UButton
                variant="ghost"
                color="neutral"
                size="sm"
                icon="i-lucide-ratio"
                trailing-icon="i-lucide-chevron-down"
              >
                {{
                  effectiveOverrides.advanced_size_mode
                    ? effectiveOverrides.size
                    : computeSize(effectiveOverrides.aspect_ratio, effectiveOverrides.resolution)
                }}
                <span v-if="n > 1" class="ml-1 text-toned">/ {{ n }}</span>
              </UButton>
              <template #content>
                <div class="p-4 w-[340px] flex flex-col gap-3">
                  <SizeSelector
                    :aspect-ratio="effectiveOverrides.aspect_ratio"
                    :resolution="effectiveOverrides.resolution"
                    :advanced="effectiveOverrides.advanced_size_mode"
                    :advanced-text="effectiveOverrides.size"
                    @change="handleSizeChange"
                  />
                  <USeparator />
                  <UFormField :label="t('gen.n')">
                    <UInputNumber v-model="n" :min="1" :max="10" size="sm" class="w-24" />
                  </UFormField>
                </div>
              </template>
            </UPopover>
            <UPopover>
              <UButton
                variant="ghost"
                color="neutral"
                size="sm"
                icon="i-lucide-sliders"
                trailing-icon="i-lucide-chevron-down"
              >
                {{ t("edit.advanced") }}
              </UButton>
              <template #content>
                <div class="p-4 w-[380px] flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
                  <template v-if="!isGoogle">
                    <ParamSourceHeader
                      :cfg="cfg.config"
                      :source="paramSource"
                      :custom-value="customOverrides"
                      @update:source="handleSourceChange"
                    />
                    <ParamFieldsCard
                      v-if="paramSource === 'custom'"
                      v-model:value="customOverrides"
                    />
                  </template>
                  <UAlert v-else color="info" variant="soft" :title="t('gen.googleHint')" />
                </div>
              </template>
            </UPopover>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-mono text-[10.5px] text-toned tabular-nums">
              {{ prompt.length }} / 4000
            </span>
            <UButton
              color="primary"
              size="md"
              icon="i-lucide-arrow-up"
              :aria-label="t('gen.submit')"
              :title="`${t('gen.submit')} · Ctrl+↵`"
              :disabled="!resolved || !prompt.trim()"
              class="!rounded-full !w-9 !h-9 !p-0 flex items-center justify-center"
              @click="submit"
            />
          </div>
        </div>
      </div>

      <!-- Quick-fill: recent prompts as soft chips. Centered, wraps. -->
      <div
        v-if="recentPrompts.length > 0"
        class="relative flex flex-wrap items-center justify-center gap-2 max-w-3xl px-4"
      >
        <span class="text-[10.5px] font-mono uppercase tracking-[0.18em] text-toned shrink-0">
          {{ t("gen.recentPrompts") }}
        </span>
        <button
          v-for="(p, i) in recentPrompts"
          :key="i"
          type="button"
          :title="p"
          class="max-w-[260px] px-3 py-1.5 rounded-full text-xs text-highlighted bg-default/60 hover:bg-default border border-default backdrop-blur-sm truncate transition"
          @click="prompt = p"
        >
          {{ p }}
        </button>
      </div>

      <!-- Bottom-right "view history" link, sits over the blobs. -->
      <div class="relative">
        <UButton
          variant="link"
          size="xs"
          color="neutral"
          icon="i-lucide-clock"
          trailing-icon="i-lucide-arrow-right"
          to="/history"
        >
          {{ t("gen.viewHistory") }}
        </UButton>
      </div>
    </div>

    <!-- ── Generating mode ─────────────────────────────────────── -->
    <div
      v-else-if="mode === 'generating'"
      v-anim
      class="flex-1 flex flex-col items-center justify-center gap-5 py-6"
    >
      <!-- Animated halo around the preview while running. -->
      <div
        class="relative w-full max-w-[min(560px,70vh)] aspect-square rounded-xl overflow-hidden border border-primary/40 bg-elevated/40 shadow-[0_0_0_4px_rgba(0,0,0,0)]"
      >
        <img
          v-if="partialUrl"
          :src="partialUrl"
          alt=""
          class="size-full object-contain"
        />
        <div v-else class="absolute inset-0 flex items-center justify-center">
          <div class="relative w-20 h-20">
            <div class="absolute inset-0 rounded-full border-2 border-default" />
            <div
              class="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"
            />
          </div>
        </div>
        <!-- Subtle animated gradient sheen along the bottom -->
        <div class="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
      </div>

      <!-- Status / meta block under the preview. -->
      <div class="text-center max-w-xl px-4 flex flex-col gap-2">
        <div class="text-[10.5px] font-mono uppercase tracking-[0.18em] text-primary">
          {{ partial ? t("results.partial", { idx: partial.index + 1 }) : t("status.generating") }}
        </div>
        <p class="text-sm text-highlighted italic leading-relaxed">
          “{{ currentTask?.prompt }}”
        </p>
        <div class="flex items-center justify-center gap-2 text-[11px] font-mono text-toned">
          <span class="text-highlighted">{{ currentTask?.modelLabel }}</span>
          <span>·</span>
          <span>{{ currentTask?.size }}</span>
          <template v-if="(currentTask?.imagePaths.length ?? 0) > 0">
            <span>·</span>
            <span>{{ currentTask?.imagePaths.length }} refs</span>
          </template>
          <span>·</span>
          <span class="tabular-nums">{{ elapsedSec }}s</span>
        </div>
      </div>
    </div>

    <!-- ── Result mode ─────────────────────────────────────────── -->
    <div
      v-else
      v-anim
      class="flex-1 flex flex-col gap-3 min-h-0"
    >
      <!-- Top bar: back / regenerate -->
      <div class="flex items-center justify-between gap-2 shrink-0">
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          icon="i-lucide-arrow-left"
          @click="backToForm"
        >
          {{ t("gen.backToForm") }}
        </UButton>
        <UButton
          color="primary"
          size="sm"
          icon="i-lucide-refresh-cw"
          :disabled="!resolved"
          @click="submit"
        >
          {{ t("gen.regenerate") }}
        </UButton>
      </div>

      <!-- Metadata strip: model / size / count, plus the prompt that
           produced this result. Helps the user remember context after
           coming back to /generate via the sidebar. -->
      <div
        class="flex items-center gap-2 px-3 py-2 rounded-md border border-default bg-elevated/40 text-[11.5px] font-mono shrink-0"
      >
        <UIcon name="i-lucide-image-check" class="size-3.5 text-primary shrink-0" />
        <span class="text-highlighted truncate">{{ currentTask?.modelLabel }}</span>
        <span class="text-toned">·</span>
        <span class="text-toned">{{ currentTask?.size }}</span>
        <span class="text-toned">·</span>
        <span class="text-toned">×{{ results.length }}</span>
        <span class="text-toned mx-1">|</span>
        <span class="italic text-muted truncate min-w-0" :title="currentTask?.prompt">
          {{ currentTask?.prompt }}
        </span>
      </div>

      <ResultsView
        :results="results"
        :partial="null"
        :streaming="false"
        class="flex-1 min-h-0"
      />
    </div>
  </div>
</template>
