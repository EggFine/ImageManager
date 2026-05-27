import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { Card } from "@/components/Page";
import { Field, Label } from "@/components/ui/Label";
import { Select, SelectItem } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { AppConfig } from "@/services/config";
import { cn } from "@/lib/utils";

/** The subset of AppConfig that's overridable per-task. */
export interface TaskOverrides {
  quality: AppConfig["quality"];
  output_format: AppConfig["output_format"];
  output_compression: number;
  background: AppConfig["background"];
  /** Only meaningful on Edit page; passed through opaquely on Generate. */
  input_fidelity: AppConfig["input_fidelity"];
}

/** Take the relevant fields off an AppConfig — initial state for a new run. */
export function defaultsFromConfig(cfg: AppConfig): TaskOverrides {
  return {
    quality: cfg.quality,
    output_format: cfg.output_format,
    output_compression: cfg.output_compression,
    background: cfg.background,
    input_fidelity: cfg.input_fidelity,
  };
}

/** Compare overrides against config — returns true if any field diverges. */
export function isDirty(cfg: AppConfig, overrides: TaskOverrides): boolean {
  return (
    overrides.quality !== cfg.quality ||
    overrides.output_format !== cfg.output_format ||
    overrides.output_compression !== cfg.output_compression ||
    overrides.background !== cfg.background ||
    overrides.input_fidelity !== cfg.input_fidelity
  );
}

interface Props {
  cfg: AppConfig;
  value: TaskOverrides;
  onChange: (next: TaskOverrides) => void;
  /** Show the input_fidelity row (Edit page only — generation doesn't use it). */
  showFidelity?: boolean;
}

export function OutputOverrides({ cfg, value, onChange, showFidelity }: Props) {
  const { t } = useTranslation();
  const dirty = isDirty(cfg, value);
  const showCompression = value.output_format === "jpeg" || value.output_format === "webp";

  const patch = (p: Partial<TaskOverrides>) => onChange({ ...value, ...p });

  return (
    <Card
      label={t("cardLabel.output")}
      labelTrailing={
        dirty ? (
          <button
            type="button"
            onClick={() => onChange(defaultsFromConfig(cfg))}
            className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded text-[10.5px] text-accent hover:bg-inset/70 transition-colors"
          >
            <RotateCcw size={11} strokeWidth={1.75} />
            {t("taskOverride.reset")}
          </button>
        ) : (
          <span className="text-[10.5px] text-trace">{t("taskOverride.hint")}</span>
        )
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field>
          <FieldLabel
            label={t("settings.quality")}
            modified={value.quality !== cfg.quality}
            modifiedLabel={t("taskOverride.modified")}
          />
          <Select value={value.quality} onValueChange={(v) => patch({ quality: v as AppConfig["quality"] })}>
            <SelectItem value="auto">{t("settings.qualityAuto")}</SelectItem>
            <SelectItem value="low">{t("settings.qualityLow")}</SelectItem>
            <SelectItem value="medium">{t("settings.qualityMedium")}</SelectItem>
            <SelectItem value="high">{t("settings.qualityHigh")}</SelectItem>
          </Select>
        </Field>

        <Field>
          <FieldLabel
            label={t("settings.background")}
            modified={value.background !== cfg.background}
            modifiedLabel={t("taskOverride.modified")}
          />
          <Select value={value.background} onValueChange={(v) => patch({ background: v as AppConfig["background"] })}>
            <SelectItem value="auto">{t("settings.backgroundAuto")}</SelectItem>
            <SelectItem value="transparent">{t("settings.backgroundTransparent")}</SelectItem>
            <SelectItem value="opaque">{t("settings.backgroundOpaque")}</SelectItem>
          </Select>
        </Field>

        <Field>
          <FieldLabel
            label={t("settings.outputFormat")}
            modified={value.output_format !== cfg.output_format}
            modifiedLabel={t("taskOverride.modified")}
          />
          <Select value={value.output_format} onValueChange={(v) => patch({ output_format: v as AppConfig["output_format"] })}>
            <SelectItem value="auto">{t("settings.outputFormatAuto")}</SelectItem>
            <SelectItem value="png">{t("settings.outputFormatPng")}</SelectItem>
            <SelectItem value="jpeg">{t("settings.outputFormatJpeg")}</SelectItem>
            <SelectItem value="webp">{t("settings.outputFormatWebp")}</SelectItem>
          </Select>
        </Field>

        {showCompression && (
          <Field>
            <FieldLabel
              label={t("settings.outputCompression")}
              modified={value.output_compression !== cfg.output_compression}
              modifiedLabel={t("taskOverride.modified")}
            />
            <NumberInput
              value={value.output_compression}
              onChange={(v) => patch({ output_compression: v })}
              min={0}
              max={100}
            />
          </Field>
        )}

        {showFidelity && (
          <Field className={showCompression ? "md:col-span-2" : ""}>
            <FieldLabel
              label={t("settings.fidelity")}
              modified={value.input_fidelity !== cfg.input_fidelity}
              modifiedLabel={t("taskOverride.modified")}
            />
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
    </Card>
  );
}

function FieldLabel({
  label,
  modified,
  modifiedLabel,
}: {
  label: string;
  modified: boolean;
  modifiedLabel: string;
}) {
  return (
    <Label
      hint={
        modified ? (
          <span className="inline-flex items-center gap-1 text-accent">
            <span className={cn("w-1.5 h-1.5 rounded-full bg-accent")} aria-hidden />
            {modifiedLabel}
          </span>
        ) : undefined
      }
    >
      {label}
    </Label>
  );
}
