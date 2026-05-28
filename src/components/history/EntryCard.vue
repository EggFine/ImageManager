<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { gsap } from "gsap";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { readEntryImage, type CacheEntry } from "@/services/imageCache";
import { useConfigStore } from "@/stores/config";

const props = defineProps<{ entry: CacheEntry }>();
const emit = defineEmits<{ "use-prompt": []; delete: [] }>();

const { t } = useI18n();
const router = useRouter();
const cfg = useConfigStore();

// We render up to 3 stack layers — the rest just live in the cache and
// are accessible via the detail page.
const STACK_MAX = 3;
const stackCount = computed(() => Math.min(props.entry.files.length, STACK_MAX));

const thumbs = ref<string[]>([]);

async function loadThumbs() {
  thumbs.value.forEach((u) => URL.revokeObjectURL(u));
  thumbs.value = [];
  const mime =
    props.entry.ext === "jpeg"
      ? "image/jpeg"
      : props.entry.ext === "webp"
        ? "image/webp"
        : "image/png";
  // Only need the first STACK_MAX files for the stack visual.
  for (const filename of props.entry.files.slice(0, STACK_MAX)) {
    try {
      const bytes = await readEntryImage(filename);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
      thumbs.value = [...thumbs.value, url];
    } catch (e) {
      console.warn("Failed to load thumb", filename, e);
    }
  }
}

watch(() => props.entry.id, loadThumbs, { immediate: true });
onBeforeUnmount(() => thumbs.value.forEach((u) => URL.revokeObjectURL(u)));

const relTime = computed(() => {
  const delta = (Date.now() - props.entry.timestamp) / 1000;
  if (delta < 60) return t("historyPage.relTime.justNow");
  if (delta < 3600) return t("historyPage.relTime.minutesAgo", { n: Math.floor(delta / 60) });
  if (delta < 86400) return t("historyPage.relTime.hoursAgo", { n: Math.floor(delta / 3600) });
  if (delta < 86400 * 7) return t("historyPage.relTime.daysAgo", { n: Math.floor(delta / 86400) });
  return new Date(props.entry.timestamp).toLocaleDateString();
});

function goToDetail() {
  void router.push(`/history/${props.entry.id}`);
}

async function saveAll() {
  let dir = cfg.config.save_directory;
  if (!dir) {
    const picked = await openDialog({ directory: true });
    if (!picked || typeof picked !== "string") return;
    dir = picked;
  }
  const ts = new Date(props.entry.timestamp).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  let saved = 0;
  for (let i = 0; i < props.entry.files.length; i++) {
    try {
      const filename = `image_${ts}_${String(i + 1).padStart(2, "0")}.${props.entry.ext}`;
      const bytes = await readEntryImage(props.entry.files[i]);
      await writeFile(`${dir.replace(/\\/g, "/")}/${filename}`, bytes);
      saved++;
    } catch (e) {
      console.error("save failed", e);
    }
  }
  cfg.setStatus(t("status.savedMany", { saved, total: props.entry.files.length, dir }));
}

// Stack layer animation. i indexes from BACK to FRONT inside the v-for
// (i=0 is the back-most peeking layer, i=stackCount-1 is the front card).
//
// Hover entrance is a 2-stage Fluent-style press-release, tuned for
// "elegant" rather than "snappy":
//   1. Press   (180ms, sine.inOut)             — gentle scale to 0.95
//   2. Release (560ms, power3.out, stagger)    — scale to 1.04 AND fan
//      layers out; held at this state for the duration of the hover
//
// Key choices for the Fluent feel:
//   - Longer durations (~740ms total enter) so motion reads as deliberate
//     rather than reactive. WinUI's "Pronounced" motion bracket is ~500ms;
//     the press + release combo lands a hair above that, which feels right
//     for content reveal.
//   - sine.inOut on the press: gentlest of the smooth-in-smooth-out curves.
//     power2.in would feel like a button being slammed; sine.inOut feels
//     like cushion compression.
//   - power3.out on the release: GSAP's closest built-in to Fluent's
//     "Decelerate" curve (cubic-bezier(0.1, 0.9, 0.2, 1)). Strong initial
//     velocity tapering into a slow settle.
//   - Subtle final scale (1.04, not 1.06+) and shallow press (0.95, not
//     0.92): Fluent hover hints are typically 2-4% scale, not 6-8%.
//   - Tiny stagger 0.025 between layers — just enough to read as cascade,
//     not enough to feel staccato.
//
// Single-image cards run the same curve. The hover/rest position tables
// agree on `(0, 0, 0deg, 1)` for index 0, so a single layer's x/y/
// rotation/opacity deltas are zero and only the scale tween is visible:
// a press + lift that matches the multi-image interaction language.
//
// Leave is a single 380ms power2.inOut tween back to rest + scale 1.
//
// `x` / `y` are strings so px (rest peek values) and % (hover spread)
// can mix freely; GSAP handles both unit-aware.
interface Position {
  x: string;
  y: string;
  rotate: number;
  opacity: number;
}

const STACK_REST: readonly Position[] = [
  { x: "0", y: "0", rotate: 0, opacity: 1 },           // front
  { x: "-6px", y: "-4px", rotate: -4, opacity: 0.78 }, // 2nd
  { x: "7px", y: "5px", rotate: 6, opacity: 0.5 },     // 3rd back
];

// Per-step fan distance, as a percentage of the layer's own width/height
// (CSS translate(%) is relative to the element's own size). 108% gives an
// ~8% visual gap between fanned cards.
const FAN_STEP_PCT = 108;

type FanDirection = "right" | "left" | "down" | "up";
type Slot = { dir: FanDirection; slot: number };

const DIRECTIONS: readonly FanDirection[] = ["right", "left", "down", "up"];

function axisOf(dir: FanDirection): "h" | "v" {
  return dir === "right" || dir === "left" ? "h" : "v";
}

/**
 * Plan slot positions for each back layer independently. Drives layout
 * shape from the card's actual position inside the viewport:
 *
 * Algorithm per layer:
 *   - Build a candidate list with all 4 cardinals at their next-free
 *     slot (1, 2, ...). Slack = space_in_direction - required_offset;
 *     positive means "still fits inside bounds", negative means "would
 *     overflow by this much". We keep negative-slack candidates in the
 *     pool because in extreme cases (small viewport, card at the edge)
 *     *every* slot 1 would technically overflow — we still need a
 *     least-bad choice, not a forced same-direction stack.
 *
 *   - Sorting rules, in order:
 *
 *     1. Lower slot wins. So we prefer spreading to a new direction
 *        over stacking a second card in an already-used direction,
 *        unless one direction has all the slack.
 *
 *     2. Within the same slot, if BOTH candidates fit (slack ≥ 0),
 *        prefer the one in an axis we haven't used yet. This produces
 *        the mixed-axis layouts the user wants in unconstrained cases
 *        ("right + down" rather than "right + left" for middle cards).
 *        When one (or both) candidates overflow, we skip this rule —
 *        forcing axis variety would mean choosing an obviously-worse
 *        overflow just for variety, which is wrong.
 *
 *     3. Final tiebreak: most remaining slack. Bigger slack = more
 *        comfortable fit (or, when both negative, less overflow).
 *
 * Net effect: cards near a corner spread into the open quadrant;
 * cards near an edge spread along the perpendicular axis; cards in
 * the middle pick one direction by available space and then the other
 * layer by perpendicular axis. Same-direction stacking only happens
 * when really nothing else fits.
 */
function planFanSlots(
  rect: DOMRect,
  bounds: DOMRect,
  layers: number
): Slot[] {
  const step = FAN_STEP_PCT / 100;
  const space: Record<FanDirection, number> = {
    right: bounds.right - rect.right,
    left: rect.left - bounds.left,
    down: bounds.bottom - rect.bottom,
    up: rect.top - bounds.top,
  };
  const dim: Record<FanDirection, number> = {
    right: rect.width,
    left: rect.width,
    down: rect.height,
    up: rect.height,
  };
  const used: Record<FanDirection, number> = { right: 0, left: 0, down: 0, up: 0 };
  const out: Slot[] = [];

  for (let layer = 0; layer < layers; layer++) {
    const usedAxes = new Set<"h" | "v">();
    for (const s of out) usedAxes.add(axisOf(s.dir));

    const candidates = DIRECTIONS.map((dir) => {
      const nextSlot = used[dir] + 1;
      const need = nextSlot * step * dim[dir];
      return { dir, slot: nextSlot, slack: space[dir] - need };
    });

    candidates.sort((a, b) => {
      if (a.slot !== b.slot) return a.slot - b.slot;
      // Same-slot tier. Axis-spread preference only kicks in when both
      // candidates would actually fit — otherwise forcing a different
      // axis would just mean a worse overflow.
      if (a.slack >= 0 && b.slack >= 0) {
        const aSame = usedAxes.has(axisOf(a.dir));
        const bSame = usedAxes.has(axisOf(b.dir));
        if (aSame !== bSame) return aSame ? 1 : -1;
      }
      return b.slack - a.slack;
    });

    const chosen = candidates[0];
    out.push({ dir: chosen.dir, slot: chosen.slot });
    used[chosen.dir] = chosen.slot;
  }
  return out;
}

/**
 * Convert the per-back-layer slot plan into a position table indexed the
 * same way as STACK_REST (out[0] = front anchor, out[1..N-1] = back
 * layers in increasing visual distance from the origin).
 */
function buildHoverTable(slots: Slot[]): Position[] {
  const out: Position[] = [{ x: "0", y: "0", rotate: 0, opacity: 1 }];
  for (const { dir, slot } of slots) {
    const d = FAN_STEP_PCT * slot;
    const x = dir === "right" ? `${d}%` : dir === "left" ? `-${d}%` : "0";
    const y = dir === "down" ? `${d}%` : dir === "up" ? `-${d}%` : "0";
    out.push({ x, y, rotate: 0, opacity: 1 });
  }
  return out;
}

const hovered = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const layerRefs = ref<(HTMLElement | null)[]>([]);
let activeAnim: gsap.core.Animation | null = null;

function setLayerRef(el: Element | null, i: number) {
  // Vue calls this with the element on mount and `null` on unmount.
  layerRefs.value[i] = el instanceof HTMLElement ? el : null;
}

function liveLayers(): HTMLElement[] {
  return layerRefs.value.filter((el): el is HTMLElement => !!el);
}

// Apply rest positions imperatively. Used at initial mount and any time
// stackCount changes (e.g. entry reloaded with different file count).
function applyRest() {
  const els = liveLayers();
  const total = stackCount.value;
  els.forEach((el, i) => {
    const back = total - 1 - i;
    const p = STACK_REST[back] ?? STACK_REST[STACK_REST.length - 1];
    gsap.set(el, {
      x: p.x,
      y: p.y,
      rotation: p.rotate,
      opacity: p.opacity,
      scale: 1,
    });
    el.style.zIndex = String(i + 1);
  });
}

onMounted(async () => {
  // Wait for ref callbacks to populate after the initial v-for render.
  await nextTick();
  applyRest();
});

watch(stackCount, async () => {
  activeAnim?.kill();
  hovered.value = false;
  await nextTick();
  applyRest();
});

function onMouseEnter() {
  hovered.value = true;
  const total = stackCount.value;

  activeAnim?.kill();
  const els = liveLayers();
  if (els.length === 0) return;

  // Plan each back layer's slot independently — every layer can pick its
  // own direction (right/left/down/up) and stack depth based on the
  // card's current position inside the scrollable <main>. So a card
  // pinned to the right edge in a 2-col grid might place "1 left + 1
  // down" rather than fanning all cards in a single direction.
  const rect = rootRef.value?.getBoundingClientRect();
  const mainEl = rootRef.value?.closest("main") as HTMLElement | null;
  const bounds =
    mainEl?.getBoundingClientRect() ??
    new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  const slots = rect ? planFanSlots(rect, bounds, total - 1) : [];
  const hoverTable = buildHoverTable(slots);

  const tl = gsap.timeline();
  // Phase 1: gentle press — cushion compresses, no slam.
  tl.to(els, {
    scale: 0.95,
    duration: 0.18,
    ease: "sine.inOut",
  });
  // Phase 2: release + fan — Fluent decelerate. Holds at scale 1.04
  // (a subtle "lifted" state) for the duration of the hover; we do NOT
  // settle back to scale 1.
  tl.to(els, {
    scale: 1.04,
    x: (i: number) => hoverTable[total - 1 - i].x,
    y: (i: number) => hoverTable[total - 1 - i].y,
    rotation: 0,
    opacity: 1,
    duration: 0.56,
    ease: "power3.out",
    stagger: 0.025,
  });
  activeAnim = tl;
}

function onMouseLeave() {
  hovered.value = false;
  const total = stackCount.value;

  activeAnim?.kill();
  const els = liveLayers();
  if (els.length === 0) return;

  activeAnim = gsap.to(els, {
    scale: 1,
    x: (i: number) => STACK_REST[total - 1 - i].x,
    y: (i: number) => STACK_REST[total - 1 - i].y,
    rotation: (i: number) => STACK_REST[total - 1 - i].rotate,
    opacity: (i: number) => STACK_REST[total - 1 - i].opacity,
    duration: 0.38,
    ease: "power2.inOut",
  });
}

onBeforeUnmount(() => activeAnim?.kill());
</script>

<template>
  <div
    ref="rootRef"
    class="group relative flex flex-col gap-3 cursor-pointer transition"
    :class="hovered && 'z-10'"
    data-blur-item
    :data-card-active="(hovered && stackCount > 1) || null"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @click="goToDetail"
  >
    <!-- Image stack — front card on top, peeking back cards underneath.
         Hover triggers a 3-stage GSAP timeline: press (shrink), release
         (overshoot scale up), expand (settle + fan out with stagger).
         No CSS transition on the layers — GSAP writes inline transforms
         per frame, and a CSS transition would fight every write. -->
    <div class="relative aspect-square">
      <div
        v-for="(_, i) in stackCount"
        :key="i"
        :ref="(el) => setLayerRef(el as Element | null, i)"
        class="absolute inset-0 rounded-lg overflow-hidden border border-default bg-elevated/40 shadow-sm"
      >
        <img
          v-if="thumbs[stackCount - 1 - i]"
          :src="thumbs[stackCount - 1 - i]"
          alt=""
          class="size-full object-cover select-none"
        />
        <div v-else class="size-full animate-pulse bg-elevated" />
      </div>

      <!-- Top-left: page badge (overlayed on the front card) -->
      <UBadge
        :label="entry.page === 'generate' ? 'GEN' : 'EDIT'"
        color="neutral"
        variant="solid"
        size="xs"
        class="absolute top-2 left-2 font-mono text-[9px] tracking-wider z-10 pointer-events-none"
      />

      <!-- Top-right: image count chip (only if multiple) -->
      <div
        v-if="entry.files.length > 1"
        class="absolute top-2 right-2 z-10 pointer-events-none px-1.5 py-0.5 rounded font-mono text-[10px] tabular-nums bg-inverted/65 text-inverted backdrop-blur-sm"
      >
        ×{{ entry.files.length }}
      </div>

      <!-- Bottom-right: hover actions -->
      <div
        class="absolute bottom-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <UButton
          icon="i-lucide-corner-down-left"
          variant="solid"
          color="primary"
          size="xs"
          :aria-label="t('historyPage.usePrompt')"
          :title="t('historyPage.usePrompt')"
          @click.stop="emit('use-prompt')"
        />
        <UButton
          icon="i-lucide-download-cloud"
          variant="solid"
          color="neutral"
          size="xs"
          :aria-label="t('historyPage.saveBatch')"
          :title="t('historyPage.saveBatch')"
          @click.stop="saveAll"
        />
        <UButton
          icon="i-lucide-trash-2"
          variant="solid"
          color="error"
          size="xs"
          :aria-label="t('historyPage.deleteOne')"
          :title="t('historyPage.deleteOne')"
          @click.stop="emit('delete')"
        />
      </div>
    </div>

    <!-- Caption -->
    <div class="px-0.5 flex flex-col gap-1">
      <p class="text-sm text-highlighted leading-snug line-clamp-2">{{ entry.prompt }}</p>
      <div class="flex items-center gap-1.5 text-[10.5px] text-toned font-mono uppercase tracking-wider">
        <span class="text-primary">{{ entry.page }}</span>
        <span>·</span>
        <span class="truncate">{{ entry.size }}</span>
        <span>·</span>
        <span>{{ relTime }}</span>
      </div>
    </div>
  </div>
</template>
