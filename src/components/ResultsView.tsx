import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Download, DownloadCloud } from "lucide-react";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { cn } from "@/lib/utils";
import { Button } from "./ui/Button";
import type { ImageResult } from "../services/apiClient";
import { useConfig } from "../services/store";

interface Props {
  results: ImageResult[];
  partial: { bytes: Uint8Array; index: number } | null;
  streaming: boolean;
}

function bytesToUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
}

export function ResultsView({ results, partial, streaming }: Props) {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const setStatus = useConfig((s) => s.setStatus);
  const [selected, setSelected] = useState(0);

  const thumbUrls = useMemo(() => results.map((r) => bytesToUrl(r.bytes)), [results]);
  const partialUrl = useMemo(() => (partial ? bytesToUrl(partial.bytes) : null), [partial]);

  useEffect(() => {
    return () => {
      thumbUrls.forEach((u) => URL.revokeObjectURL(u));
      if (partialUrl) URL.revokeObjectURL(partialUrl);
    };
  }, [thumbUrls, partialUrl]);

  useEffect(() => {
    if (results.length === 0) setSelected(0);
    else if (selected >= results.length) setSelected(0);
  }, [results.length, selected]);

  const previewUrl = results.length > 0 ? thumbUrls[selected] : partialUrl;

  const statusText = useMemo(() => {
    if (streaming && results.length === 0) {
      return partial ? t("results.partial", { idx: partial.index + 1 }) : t("results.streaming");
    }
    return results.length > 0 ? t("results.count", { count: results.length }) : "";
  }, [streaming, results.length, partial, t]);

  const saveOne = async () => {
    if (results.length === 0) return;
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const suggested = `image_${ts}.png`;
    let target: string | null = null;
    if (cfg.save_directory) {
      target = `${cfg.save_directory.replace(/\\/g, "/")}/${suggested}`;
    } else {
      target = await saveDialog({
        defaultPath: suggested,
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
    }
    if (!target) return;
    await writeFile(target, results[selected].bytes);
    setStatus(t("status.savedOne", { path: target }));
  };

  const saveAll = async () => {
    if (results.length === 0) return;
    let dir = cfg.save_directory;
    if (!dir) {
      const picked = await openDialog({ directory: true });
      if (!picked || typeof picked !== "string") return;
      dir = picked;
    }
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    let saved = 0;
    for (let i = 0; i < results.length; i++) {
      try {
        const name = `image_${ts}_${String(i + 1).padStart(2, "0")}.png`;
        await writeFile(`${dir.replace(/\\/g, "/")}/${name}`, results[i].bytes);
        saved++;
      } catch (e) {
        console.error("save failed", e);
      }
    }
    setStatus(t("status.savedMany", { saved, total: results.length, dir }));
  };

  const showStream = streaming && results.length === 0;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3 px-1.5">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="eyebrow shrink-0">{t("results.label")}</span>
          <span className="font-display italic text-[19px] leading-none text-ink truncate">
            {t("results.title")}
          </span>
        </div>
        <span className="font-mono text-[10.5px] tracking-wider text-faded shrink-0">
          {statusText}
        </span>
      </div>

      {/* Main preview area */}
      <div
        className={cn(
          "relative flex-1 min-h-[260px] md:min-h-[320px] lg:min-h-[360px] rounded-[var(--radius)] overflow-hidden",
          "border border-rule/80 bg-inset/60 shadow-card"
        )}
      >
        {/* Subtle paper texture inside the preview frame */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 0%, color-mix(in oklab, var(--accent) 6%, transparent), transparent 60%)",
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6 lg:p-10">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className={cn(
                "max-w-full max-h-full object-contain select-none rounded-[6px]",
                "shadow-[0_2px_8px_rgba(0,0,0,0.08),0_12px_30px_rgba(0,0,0,0.10)]",
                "dark:shadow-[0_2px_8px_rgba(0,0,0,0.5),0_12px_30px_rgba(0,0,0,0.4)]",
                showStream && "animate-pulse"
              )}
            />
          ) : (
            <EmptyState streaming={showStream} />
          )}
        </div>

        {/* Frame caption — solid backdrop with strong contrast over any image */}
        {results.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[10.5px] tracking-[0.18em] px-2.5 py-1 rounded-full bg-ink/85 text-paper backdrop-blur-sm">
            <span className="tabular-nums">
              {String(selected + 1).padStart(2, "0")} / {String(results.length).padStart(2, "0")}
            </span>
          </div>
        )}
      </div>

      {/* Thumbnail contact strip */}
      {results.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {results.map((_r, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              aria-label={t("results.selectThumb", { n: i + 1 })}
              aria-pressed={i === selected}
              className={cn(
                "shrink-0 w-16 h-16 relative rounded-[var(--radius-sm)] overflow-hidden",
                "border-2 transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                i === selected
                  ? "border-accent shadow-[0_2px_8px_color-mix(in_oklab,var(--accent)_35%,transparent)]"
                  : "border-rule hover:border-rule-strong"
              )}
              title={`#${i + 1}`}
            >
              <img src={thumbUrls[i]} alt="" className="w-full h-full object-cover" />
              <span
                className={cn(
                  "absolute top-0.5 left-1 font-mono text-[10px] tabular-nums",
                  "px-1 rounded-sm bg-ink/70 text-paper"
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 items-center">
        <Button onClick={saveOne} disabled={results.length === 0} variant="outline" size="sm">
          <Download size={12} /> {t("results.saveOne")}
        </Button>
        <Button onClick={saveAll} disabled={results.length === 0} variant="ghost" size="sm">
          <DownloadCloud size={12} /> {t("results.saveAll")}
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ streaming }: { streaming: boolean }) {
  const { t } = useTranslation();
  if (streaming) {
    return (
      <div className="flex flex-col items-center gap-4 text-faded">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-rule" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
        </div>
        <div className="text-center">
          <div className="serif-italic text-[15px] text-faded">{t("results.streaming")}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 text-trace">
      <div className="w-14 h-14 rounded-full bg-card border border-rule/70 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
        <ImagePlus size={22} strokeWidth={1.5} className="text-faded" />
      </div>
      <div className="text-center">
        <div className="serif-italic text-[15px] text-faded leading-tight">{t("results.empty")}</div>
        <div className="eyebrow mt-1.5 text-trace">{t("results.emptyHint")}</div>
      </div>
    </div>
  );
}
