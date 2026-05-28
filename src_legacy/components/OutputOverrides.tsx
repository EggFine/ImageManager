import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/Page";
import { Field, Label } from "@/components/ui/Label";
import { Select, SelectItem } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { AppConfig, ParamPreset } from "@/services/config";
import { cn } from "@/lib/utils";

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
  /** Only meaningful on Edit page; passed through opaquely on Generate. */
  input_fidelity: AppConfig["input_fidelity"];
}

/** Take the relevant fields off an AppConfig — the "global defaults" view. */
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

/** Project a saved preset down to the TaskOverrides shape. */
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
 *  Source can be "global", "custom", or a preset id. */
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

/** Top card on Generate/Edit pages — the source Select. When the source is
 *  global or a preset, a compact summary of the effective params is shown
 *  inline so the user can see what they're shipping. When source is custom,
 *  the Dimensions + editable fields render as separate cards below this
 *  one (see ParamFieldsCard). */
export function ParamSourceHeader({
  cfg,
  source,
  onSourceChange,
  customValue,
  showFidelity,
}: {
  cfg: AppConfig;
  source: string;
  onSourceChange: (next: string) => void;
  customValue: TaskOverrides;
  showFidelity?: boolean;
}) {
  const { t } = useTranslation();
  const effective = useMemo(
    () => resolveOverrides(cfg, source, customValue),
    [cfg, source, customValue]
  );

  return (
    <Card label={t("paramSource.label")}>
      <Select value={source} onValueChange={onSourceChange}>
        <SelectItem value="global">{t("paramSource.global")}</SelectItem>
        {cfg.param_presets.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
        <SelectItem value="custom">{t("paramSource.custom")}</SelectItem>
      </Select>
      {source !== "custom" && (
        <div className="mt-3">
          <ParamSummary overrides={effective} showFidelity={showFidelity} />
        </div>
      )}
    </Card>
  );
}

/** Editable output-knob grid — rendered only when source === "custom". */
export function ParamFieldsCard({
  value,
  onChange,
  showFidelity,
}: {
  value: TaskOverrides;
  onChange: (next: TaskOverrides) => void;
  showFidelity?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Card label={t("cardLabel.output")}>
      <OverrideFields value={value} onChange={onChange} showFidelity={showFidelity} />
    </Card>
  );
}

/** Read-only one-glance summary shown in Global / Preset mode. Uses short
 *  one-word labels (separate `paramSummary.*` i18n keys) and stacks the
 *  value beneath the label so narrow windows don't truncate everything. */
function ParamSummary({
  overrides,
  showFidelity,
}: {
  overrides: TaskOverrides;
  showFidelity?: boolean;
}) {
  const { t } = useTranslation();
  const sizeLabel = overrides.advanced_size_mode
    ? overrides.size
    : `${overrides.aspect_ratio} · ${overrides.resolution}`;
  const items: Array<[string, string]> = [
    [t("paramSummary.size"), sizeLabel],
    [t("paramSummary.quality"), overrides.quality],
    [t("paramSummary.outputFormat"), overrides.output_format],
    [t("paramSummary.background"), overrides.background],
  ];
  if (overrides.output_format === "jpeg" || overrides.output_format === "webp") {
    items.push([t("paramSummary.compression"), String(overrides.output_compression)]);
  }
  if (showFidelity) {
    items.push([t("paramSummary.fidelity"), overrides.input_fidelity]);
  }
  return (
    <div className="@container grid grid-cols-2 @lg:grid-cols-4 gap-x-3 gap-y-2.5">
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col min-w-0 leading-tight">
          <span className="text-[10.5px] text-faded uppercase tracking-wider truncate">{k}</span>
          <span className="text-[12.5px] font-mono text-ink truncate">{v}</span>
        </div>
      ))}
    </div>
  );
}

/** Editable field grid — same look as before, used in Custom mode. */
function OverrideFields({
  value,
  onChange,
  showFidelity,
}: {
  value: TaskOverrides;
  onChange: (next: TaskOverrides) => void;
  showFidelity?: boolean;
}) {
  const { t } = useTranslation();
  const showCompression = value.output_format === "jpeg" || value.output_format === "webp";
  const patch = (p: Partial<TaskOverrides>) => onChange({ ...value, ...p });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Field>
        <Label>{t("settings.quality")}</Label>
        <Select value={value.quality} onValueChange={(v) => patch({ quality: v as AppConfig["quality"] })}>
          <SelectItem value="auto">{t("settings.qualityAuto")}</SelectItem>
          <SelectItem value="low">{t("settings.qualityLow")}</SelectItem>
          <SelectItem value="medium">{t("settings.qualityMedium")}</SelectItem>
          <SelectItem value="high">{t("settings.qualityHigh")}</SelectItem>
        </Select>
      </Field>

      <Field>
        <Label>{t("settings.background")}</Label>
        <Select value={value.background} onValueChange={(v) => patch({ background: v as AppConfig["background"] })}>
          <SelectItem value="auto">{t("settings.backgroundAuto")}</SelectItem>
          <SelectItem value="transparent">{t("settings.backgroundTransparent")}</SelectItem>
          <SelectItem value="opaque">{t("settings.backgroundOpaque")}</SelectItem>
        </Select>
      </Field>

      <Field>
        <Label>{t("settings.outputFormat")}</Label>
        <Select value={value.output_format} onValueChange={(v) => patch({ output_format: v as AppConfig["output_format"] })}>
          <SelectItem value="auto">{t("settings.outputFormatAuto")}</SelectItem>
          <SelectItem value="png">{t("settings.outputFormatPng")}</SelectItem>
          <SelectItem value="jpeg">{t("settings.outputFormatJpeg")}</SelectItem>
          <SelectItem value="webp">{t("settings.outputFormatWebp")}</SelectItem>
        </Select>
      </Field>

      {showCompression && (
        <Field>
          <Label>{t("settings.outputCompression")}</Label>
          <NumberInput
            value={value.output_compression}
            onChange={(v) => patch({ output_compression: v })}
            min={0}
            max={100}
          />
        </Field>
      )}

      {showFidelity && (
        <Field className={cn(showCompression ? "md:col-span-2" : "")}>
          <Label>{t("settings.fidelity")}</Label>
          <Select
            value={value.input_fidelity}
            onValueChange={(v) => patch({ input_fidelity: v as AppConfig["input_fidelity"] })}
          >
            <SelectItem value="auto">{t("settings.fidAuto")}</SelectItem>
            <SelectItem value="high">{t("settings.fidHigh")}</SelectItem>
            <SelectItem value="low">{t("settings.fidLow")}</SelectItem>
          </Select>
        </Field>
      )}
    </div>
  );
}

