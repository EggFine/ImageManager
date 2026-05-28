import { type Directive, type Ref } from "vue";
import { gsap } from "gsap";

// Tween parameters for `v-anim`. Kept module-level so they're shared
// across all instances (and one place to tune).
const DURATION = 0.45;
const STAGGER_STEP = 0.06;
const Y_OFFSET_PX = 14;
const BURST_IDLE_RESET_MS = 200;

// `v-anim` uses a self-contained per-element tween instead of a central
// composable. The composable approach broke on async-populated lists:
// when `cache.entries` loaded after the parent's `onMounted` ran, the
// late-mounting EntryCards had `opacity:0` from the directive's
// beforeMount but no tween to bring them back, so they stayed invisible
// (the F5-on-history blank-grid bug). Per-element tweens fire from the
// directive's `mounted` hook, so any element mounted at any time
// — initial render, async data load, or v-if flip — animates in
// correctly.
//
// To preserve the staggered cascade, we use a global burst counter:
// successive `mounted` calls within BURST_IDLE_RESET_MS get consecutive
// indices (and therefore increasing delays), forming a single visual
// wave. The counter resets after a brief idle period so a later wave
// (a different page, a fresh async load) starts cleanly from 0.
let burstIdx = 0;
let burstResetTimer: number | null = null;

function nextStaggerIndex(): number {
  const idx = burstIdx++;
  if (burstResetTimer !== null) clearTimeout(burstResetTimer);
  burstResetTimer = window.setTimeout(() => {
    burstIdx = 0;
    burstResetTimer = null;
  }, BURST_IDLE_RESET_MS);
  return idx;
}

// Tracks live tweens per element so we can kill them if the element
// unmounts mid-animation.
const liveTweens = new WeakMap<HTMLElement, gsap.core.Tween>();

export const vAnim: Directive<HTMLElement, void> = {
  beforeMount(el) {
    // beforeMount fires BEFORE the element is in the DOM — setting inline
    // style here means the first paint of this element shows the from
    // state, avoiding the brief flash of fully-rendered content that
    // happens if the tween is set up only after mount.
    el.style.opacity = "0";
    el.style.transform = `translateY(${Y_OFFSET_PX}px)`;
  },
  mounted(el) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Skip animation — clear the from-state so the user sees the end
      // state immediately.
      el.style.opacity = "";
      el.style.transform = "";
      return;
    }
    const delay = nextStaggerIndex() * STAGGER_STEP;
    const tween = gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: DURATION,
      ease: "power3.out",
      delay,
      clearProps: "opacity,transform",
    });
    liveTweens.set(el, tween);
  },
  unmounted(el) {
    liveTweens.get(el)?.kill();
    liveTweens.delete(el);
  },
};

/**
 * @deprecated Per-element animation is now handled by the `v-anim`
 * directive. This is kept as a no-op so existing call sites continue to
 * compile; they can be removed in a follow-up pass.
 */
export function useEnterAnimation(
  _scope: Ref<HTMLElement | null>,
  _options: unknown = {}
): void {
  /* no-op */
}
