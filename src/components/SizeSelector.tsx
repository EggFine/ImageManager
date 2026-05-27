import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Select, SelectItem } from "./ui/Select";
import { Combobox } from "./ui/Combobox";
import { Field, Label } from "./ui/Label";
import { ASPECT_RATIOS, RESOLUTIONS, computeSize } from "../services/sizeCalc";
import { cn } from "@/lib/utils";

interface Props {
  aspectRatio: string;
  resolution: string;
  advanced: boolean;
  advancedText: string;
  onChange: (next: { aspectRatio: string; resolution: string; advanced: boolean; advancedText: string }) => void;
}

const ADVANCED_PRESETS = ["1024x1024", "1024x1536", "1536x1024", "1920x1080", "1080x1920", "2560x1440", "3840x2160"];

/** Parse "WxH" → {w, h}. Falls back to a square when malformed. */
function parseDims(s: string): { w: number; h: number } {
  const m = /^(\d+)\s*[x×]\s*(\d+)/i.exec(s.trim());
  if (!m) return { w: 1, h: 1 };
  return { w: Number(m[1]), h: Number(m[2]) };
}

/** Small visual preview of the chosen aspect ratio. */
function RatioPreview({ effective }: { effective: string }) {
  const { w, h } = parseDims(effective);
  const max = 28;
  const longest = Math.max(w, h);
  const rw = Math.max(8, (w / longest) * max);
  const rh = Math.max(8, (h / longest) * max);
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center shrink-0 w-9 h-9 rounded-[var(--radius-sm)] bg-inset/80"
    >
      <span
        className="block border border-accent/70 bg-accent/15 rounded-[2px]"
        style={{ width: `${rw}px`, height: `${rh}px` }}
      />
    </span>
  );
}

export function SizeSelector(props: Props) {
  const { t } = useTranslation();
  const { aspectRatio, resolution, advanced, advancedText, onChange } = props;

  const effective = useMemo(() => {
    if (advanced) return advancedText.trim() || "1024x1024";
    return computeSize(aspectRatio, resolution);
  }, [advanced, aspectRatio, resolution, advancedText]);

  const setMode = (next: boolean) =>
    onChange({
      aspectRatio,
      resolution,
      advanced: next,
      advancedText: advancedText || effective,
    });

  return (
    <div className="flex flex-col gap-4">
      {/* Header: title + segmented control */}
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{t("size.label")}</span>
        <div
          role="tablist"
          aria-label={t("size.label")}
          className="inline-flex items-stretch h-7 p-0.5 rounded-[var(--radius-sm)] bg-inset border border-rule/60"
        >
          <SegBtn active={!advanced} onClick={() => setMode(false)} label={t("size.modeBasic")} />
          <SegBtn active={advanced} onClick={() => setMode(true)} label={t("size.modeAdvanced")} />
        </div>
      </div>

      {!advanced ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field>
            <Label>{t("size.aspectLabel")}</Label>
            <Select
              value={aspectRatio}
              onValueChange={(v) => onChange({ aspectRatio: v, resolution, advanced, advancedText })}
            >
              {ASPECT_RATIOS.map((a) => (
                <SelectItem key={a.tag} value={a.tag}>{t(a.labelKey)}</SelectItem>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>{t("size.resolutionLabel")}</Label>
            <Select
              value={resolution}
              onValueChange={(v) => onChange({ aspectRatio, resolution: v, advanced, advancedText })}
            >
              {RESOLUTIONS.map((r) => (
                <SelectItem key={r.tag} value={r.tag}>{t(r.labelKey)}</SelectItem>
              ))}
            </Select>
          </Field>
        </div>
      ) : (
        <Field>
          <Label>{t("size.pixels")}</Label>
          <Combobox
            value={advancedText}
            onChange={(v) => onChange({ aspectRatio, resolution, advanced, advancedText: v })}
            options={ADVANCED_PRESETS}
          />
        </Field>
      )}

      {/* Effective size readout — visual ratio + mono dimensions */}
      <div className="flex items-center gap-3 pt-1 flex-wrap">
        <RatioPreview effective={effective} />
        <div className="flex-1 min-w-[120px] flex flex-col">
          <span className="eyebrow text-trace">
            {t("size.willSend").replace(": ", "")}
          </span>
          <span className="font-mono text-[14px] text-ink tabular-nums font-medium tracking-tight mt-0.5">
            {effective}
          </span>
        </div>
        <span className="hidden md:inline text-[11px] text-faded shrink-0">
          {advanced ? t("size.modeAdvancedHint") : t("size.modeBasicHint")}
        </span>
      </div>
    </div>
  );
}

function SegBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "px-3 inline-flex items-center justify-center rounded-[3px]",
        "text-[11.5px] font-medium transition-all duration-150",
        active
          ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
          : "text-faded hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}
