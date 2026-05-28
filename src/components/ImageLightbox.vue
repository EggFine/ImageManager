<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  open: boolean;
  src: string | null | undefined;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  prev: [];
  next: [];
}>();

const { t } = useI18n();

// ─── Transform state ───
// scale + (tx, ty) translate + rotation (in degrees) compose into a
// single CSS transform on the image. Wheel zooms relative to the cursor,
// pointer drags pan, the toolbar exposes rotate/zoom/reset.
const scale = ref(1);
const tx = ref(0);
const ty = ref(0);
const rotation = ref(0);
const dragging = ref(false);
const dragStart = { x: 0, y: 0, tx: 0, ty: 0 };

const SCALE_MIN = 0.1;
const SCALE_MAX = 10;

const imgStyle = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) rotate(${rotation.value}deg) scale(${scale.value})`,
  transformOrigin: "center",
  cursor: dragging.value ? "grabbing" : "grab",
}));

function resetTransform() {
  scale.value = 1;
  tx.value = 0;
  ty.value = 0;
  rotation.value = 0;
}

function clampScale(s: number): number {
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, s));
}

function zoomBy(factor: number) {
  scale.value = clampScale(scale.value * factor);
}

// Wheel zoom anchored to the cursor: after zooming, the image pixel that
// was under the cursor stays under the cursor. Otherwise zooming "pulls"
// content toward the center, which feels wrong above ~2x.
function onWheel(e: WheelEvent) {
  e.preventDefault();
  const container = e.currentTarget as HTMLElement;
  const rect = container.getBoundingClientRect();
  // Cursor relative to the container's CENTER (transform-origin is center).
  const cx = e.clientX - rect.left - rect.width / 2;
  const cy = e.clientY - rect.top - rect.height / 2;

  const oldScale = scale.value;
  // Exponential so each notch feels the same relative zoom regardless of
  // current scale.
  const delta = -e.deltaY * 0.0015;
  const newScale = clampScale(oldScale * Math.exp(delta));
  if (newScale === oldScale) return;

  const ratio = newScale / oldScale;
  tx.value = cx * (1 - ratio) + tx.value * ratio;
  ty.value = cy * (1 - ratio) + ty.value * ratio;
  scale.value = newScale;
}

function onPointerDown(e: PointerEvent) {
  // Bail out if the press started on a toolbar control — let the button
  // handle its own click instead of stealing into a drag.
  if ((e.target as HTMLElement | null)?.closest("button, [role='button']")) return;
  if (e.button !== 0) return;
  dragging.value = true;
  dragStart.x = e.clientX;
  dragStart.y = e.clientY;
  dragStart.tx = tx.value;
  dragStart.ty = ty.value;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return;
  tx.value = dragStart.tx + (e.clientX - dragStart.x);
  ty.value = dragStart.ty + (e.clientY - dragStart.y);
}
function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  try {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  } catch {
    /* pointer not captured — fine */
  }
}

// Reset transform every time the lightbox opens, and also when `src`
// changes WHILE open (e.g. prev/next swap to a different image).
watch(() => props.open, (v) => {
  if (v) resetTransform();
});
watch(() => props.src, () => {
  if (props.open) resetTransform();
});

// Keyboard. Escape closes; left/right emit nav events — parent decides
// whether they wire to anything (ResultsView ignores; HistoryDetailView
// wires them to prev/next image).
function onKey(e: KeyboardEvent) {
  if (!props.open) return;
  if (e.key === "Escape") emit("update:open", false);
  else if (e.key === "ArrowLeft") emit("prev");
  else if (e.key === "ArrowRight") emit("next");
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'max-w-[95vw]' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div
        class="relative bg-inverted/90 flex items-center justify-center min-h-[80vh] overflow-hidden touch-none"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
        @dblclick="resetTransform"
      >
        <img
          v-if="src"
          :src="src"
          alt=""
          :style="imgStyle"
          class="max-w-[80vw] max-h-[80vh] object-contain select-none rounded shadow-2xl pointer-events-none"
          draggable="false"
        />

        <!-- Close (top-right) -->
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="solid"
          size="md"
          class="absolute top-4 right-4 z-10"
          :aria-label="t('results.closeLightbox')"
          @click="emit('update:open', false)"
        />

        <!-- Toolbar: rotate · zoom · scale% · reset · [slot for extras] -->
        <div
          class="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-1.5 rounded-full bg-default border border-default shadow-lg"
        >
          <UButton
            icon="i-lucide-rotate-ccw"
            variant="ghost"
            color="neutral"
            size="sm"
            :aria-label="t('results.lb.rotateLeft')"
            :title="t('results.lb.rotateLeft')"
            @click="rotation -= 90"
          />
          <UButton
            icon="i-lucide-rotate-cw"
            variant="ghost"
            color="neutral"
            size="sm"
            :aria-label="t('results.lb.rotateRight')"
            :title="t('results.lb.rotateRight')"
            @click="rotation += 90"
          />
          <USeparator orientation="vertical" class="h-4 mx-1" />
          <UButton
            icon="i-lucide-zoom-out"
            variant="ghost"
            color="neutral"
            size="sm"
            :aria-label="t('results.lb.zoomOut')"
            :title="t('results.lb.zoomOut')"
            @click="zoomBy(0.8)"
          />
          <span
            class="font-mono text-xs tabular-nums text-muted min-w-[3.4em] text-center select-none"
          >
            {{ Math.round(scale * 100) }}%
          </span>
          <UButton
            icon="i-lucide-zoom-in"
            variant="ghost"
            color="neutral"
            size="sm"
            :aria-label="t('results.lb.zoomIn')"
            :title="t('results.lb.zoomIn')"
            @click="zoomBy(1.25)"
          />
          <USeparator orientation="vertical" class="h-4 mx-1" />
          <UButton
            icon="i-lucide-refresh-ccw"
            variant="ghost"
            color="neutral"
            size="sm"
            :aria-label="t('results.lb.reset')"
            :title="t('results.lb.reset')"
            @click="resetTransform"
          />
          <!-- Caller-supplied extras (prev/next nav, counter, save…) -->
          <slot name="toolbar-extra" />
        </div>
      </div>
    </template>
  </UModal>
</template>
