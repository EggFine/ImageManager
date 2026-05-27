import type { AppConfig, ParamPreset } from "@/services/config";

/** The subset of AppConfig that's overridable per-task. Size lives here too
 *  — picking a preset changes both size and output knobs together. */
export interface TaskOverrides {
  aspect_ratio: string;
  resolution: string;
  advanced_size_mode: boolean;
  size: string;
  quality: AppConfig["quality"];
  output_format: AppConfig["output_format"];
  output_compression: number;
  background: AppConfig["background"];
  input_fidelity: AppConfig["input_fidelity"];
}

export function defaultsFromConfig(cfg: AppConfig): TaskOverrides {
  return {
    aspect_ratio: cfg.default_aspect_ratio,
    resolution: cfg.default_resolution,
    advanced_size_mode: cfg.advanced_size_mode,
    size: cfg.default_size,
    quality: cfg.quality,
    output_format: cfg.output_format,
    output_compression: cfg.output_compression,
    background: cfg.background,
    input_fidelity: cfg.input_fidelity,
  };
}

export function presetToOverrides(p: ParamPreset): TaskOverrides {
  return {
    aspect_ratio: p.aspect_ratio,
    resolution: p.resolution,
    advanced_size_mode: p.advanced_size_mode,
    size: p.size,
    quality: p.quality,
    output_format: p.output_format,
    output_compression: p.output_compression,
    background: p.background,
    input_fidelity: p.input_fidelity,
  };
}

/** Resolve the effective TaskOverrides given the user's chosen source.
 *  Source is "global", "custom", or a preset id. */
export function resolveOverrides(
  cfg: AppConfig,
  source: string,
  customValue: TaskOverrides
): TaskOverrides {
  if (source === "custom") return customValue;
  if (source !== "global") {
    const preset = cfg.param_presets.find((p) => p.id === source);
    if (preset) return presetToOverrides(preset);
  }
  return defaultsFromConfig(cfg);
}
