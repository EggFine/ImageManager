export const ASPECT_RATIOS = [
  { tag: "1:1", labelKey: "size.aspect.1to1" },
  { tag: "4:3", labelKey: "size.aspect.4to3" },
  { tag: "3:4", labelKey: "size.aspect.3to4" },
  { tag: "16:9", labelKey: "size.aspect.16to9" },
  { tag: "9:16", labelKey: "size.aspect.9to16" },
  { tag: "3:2", labelKey: "size.aspect.3to2" },
  { tag: "2:3", labelKey: "size.aspect.2to3" },
  { tag: "21:9", labelKey: "size.aspect.21to9" },
  { tag: "9:21", labelKey: "size.aspect.9to21" },
] as const;

export const RESOLUTIONS = [
  { tag: "720p", labelKey: "size.res.720", shortEdge: 720 },
  { tag: "1080p", labelKey: "size.res.1080", shortEdge: 1080 },
  { tag: "2K", labelKey: "size.res.2K", shortEdge: 1440 },
  { tag: "4K", labelKey: "size.res.4K", shortEdge: 2160 },
] as const;

/**
 * gpt-image-2 hard constraints (OpenAI API reference, 2026-05).
 * Source: developers.openai.com/api/docs/api-reference/responses/compact
 *
 *  - both dimensions divisible by 16  ← the *real* fix for the 502 we hit:
 *    1080 % 16 = 8, so 1080×1080 silently fails upstream and the proxy
 *    folds the 400 into a 502.
 *  - aspect ratio between 1:3 and 3:1
 *  - max edge 3840 px (i.e. 4K is the documented ceiling — NOT 2000)
 *  - total pixels in [655_360, 8_294_400]
 *  - resolutions above 2560×1440 are flagged "experimental" upstream
 *    (quality may vary; requests still succeed)
 */
const MAX_DIM = 3840;
const STEP = 16;

/** Round to the nearest multiple of STEP, clamped to [STEP, MAX_DIM]. */
const quantize = (n: number): number => {
  const rounded = Math.round(n / STEP) * STEP;
  return Math.min(MAX_DIM, Math.max(STEP, rounded));
};

export function computeSize(aspectRatio: string, resolution: string): string {
  const res = RESOLUTIONS.find((r) => r.tag.toLowerCase() === resolution.toLowerCase());
  const targetShort = res?.shortEdge ?? 1080;

  const [aStr, bStr] = aspectRatio.split(":");
  const a = Number(aStr);
  const b = Number(bStr);
  if (!a || !b || a <= 0 || b <= 0) {
    const d = quantize(targetShort);
    return `${d}x${d}`;
  }

  if (a === b) {
    const d = quantize(targetShort);
    return `${d}x${d}`;
  }

  // Compute raw long/short edges, then clamp the longer to MAX_DIM
  // and recompute the shorter from the same ratio.
  let shortEdge: number = targetShort;
  let longEdge: number = Math.round((targetShort * Math.max(a, b)) / Math.min(a, b));
  if (longEdge > MAX_DIM) {
    longEdge = MAX_DIM;
    shortEdge = Math.round((MAX_DIM * Math.min(a, b)) / Math.max(a, b));
  }

  const longQ = quantize(longEdge);
  const shortQ = quantize(shortEdge);
  return a > b ? `${longQ}x${shortQ}` : `${shortQ}x${longQ}`;
}
