import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Download,
  DownloadCloud,
  Trash2,
  ImagePlus,
  CornerDownLeft,
  AlertTriangle,
} from "lucide-react";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Page, Card } from "@/components/Page";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useImageCache } from "@/services/cacheStore";
import { readEntryImage, statsOf, type CacheEntry } from "@/services/imageCache";
import { useConfig } from "@/services/store";
import { cn } from "@/lib/utils";

type Route = "home" | "generate" | "edit" | "history" | "settings";

interface Props {
  /** Optional — when set, lets the History page hand a prompt back to the
   *  caller (Generate/Edit) for instant reuse. */
  onUsePrompt?: (prompt: string, page: "generate" | "edit") => void;
  onNavigate?: (r: Route) => void;
}

export function HistoryPage({ onUsePrompt, onNavigate }: Props) {
  const { t } = useTranslation();
  const entries = useImageCache((s) => s.entries);
  const init = useImageCache((s) => s.init);
  const remove = useImageCache((s) => s.remove);
  const clear = useImageCache((s) => s.clear);
  const cfg = useConfig((s) => s.config);
  const setStatus = useConfig((s) => s.setStatus);
  const { push } = useToast();

  useEffect(() => {
    void init();
  }, [init]);

  const stats = useMemo(() => statsOf(entries), [entries]);

  const onClear = async () => {
    if (!window.confirm(t("historyPage.confirmClear"))) return;
    await clear();
    setStatus("");
  };

  const onUsePromptClick = (entry: CacheEntry) => {
    onUsePrompt?.(entry.prompt, entry.page);
    onNavigate?.(entry.page);
    push({
      title: t("historyPage.usePrompt"),
      body: entry.prompt.slice(0, 60),
      intent: "ok",
    });
  };

  return (
    <Page
      title={t("historyPage.title")}
      desc={t("historyPage.desc")}
      trailing={
        entries.length > 0 ? (
          <Button variant="ghost" onClick={onClear}>
            <Trash2 size={13} />
            {t("historyPage.clearAll")}
          </Button>
        ) : undefined
      }
    >
      {/* Notice when caching is disabled */}
      {!cfg.auto_cache && (
        <div
          className={cn(
            "rounded-[var(--radius)] border border-warning/30 bg-warning/8 p-3.5",
            "flex items-start gap-3"
          )}
        >
          <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-ink font-medium">{t("historyPage.cachingDisabled")}</div>
            <div className="text-[12px] text-faded mt-0.5">{t("historyPage.cachingDisabledHint")}</div>
          </div>
          {onNavigate && (
            <Button size="sm" variant="outline" onClick={() => onNavigate("settings")}>
              {t("nav.settings")}
            </Button>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="px-1.5 -mt-1">
            <span className="font-mono text-[11px] tracking-wider text-trace">
              {t("historyPage.entryCount", { count: stats.entryCount, images: stats.imageCount })}
            </span>
          </div>
          <div className="flex flex-col gap-3 md:gap-4">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                // Stagger the first 8 entries on initial mount; later ones
                // appear instantly so adding a new entry mid-session doesn't
                // animate past a long list.
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out"
              >
                <EntryCard
                  entry={entry}
                  onUsePrompt={() => onUsePromptClick(entry)}
                  onDelete={async () => {
                    await remove(entry.id);
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

/* ─── Entry card ─────────────────────────────────────────────────────── */

interface EntryCardProps {
  entry: CacheEntry;
  onUsePrompt: () => void;
  onDelete: () => void;
}

function EntryCard({ entry, onUsePrompt, onDelete }: EntryCardProps) {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const setStatus = useConfig((s) => s.setStatus);
  const { push } = useToast();
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [enlarged, setEnlarged] = useState<number | null>(null);

  // Load image bytes lazily, build blob URLs for the <img> tags. Revoke on unmount.
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      for (const filename of entry.files) {
        if (cancelled) return;
        try {
          const bytes = await readEntryImage(filename);
          const mime =
            entry.ext === "jpeg" ? "image/jpeg" : entry.ext === "webp" ? "image/webp" : "image/png";
          const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
          urls.push(url);
          if (!cancelled) setThumbs([...urls]);
        } catch (e) {
          console.warn("Failed to load thumb", filename, e);
        }
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [entry]);

  const saveOne = async (idx: number) => {
    const filename = entry.files[idx];
    const ts = new Date(entry.timestamp).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const suggested = `image_${ts}_${String(idx + 1).padStart(2, "0")}.${entry.ext}`;
    let target: string | null;
    if (cfg.save_directory) {
      target = `${cfg.save_directory.replace(/\\/g, "/")}/${suggested}`;
    } else {
      target = await saveDialog({
        defaultPath: suggested,
        filters: [{ name: entry.ext.toUpperCase(), extensions: [entry.ext] }],
      });
    }
    if (!target) return;
    const bytes = await readEntryImage(filename);
    await writeFile(target, bytes);
    setStatus(t("status.savedOne", { path: target }));
    push({ title: t("historyPage.saveOne"), body: target, intent: "ok" });
  };

  const saveAll = async () => {
    let dir = cfg.save_directory;
    if (!dir) {
      const picked = await openDialog({ directory: true });
      if (!picked || typeof picked !== "string") return;
      dir = picked;
    }
    const ts = new Date(entry.timestamp).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    let saved = 0;
    for (let i = 0; i < entry.files.length; i++) {
      try {
        const filename = `image_${ts}_${String(i + 1).padStart(2, "0")}.${entry.ext}`;
        const bytes = await readEntryImage(entry.files[i]);
        await writeFile(`${dir.replace(/\\/g, "/")}/${filename}`, bytes);
        saved++;
      } catch (e) {
        console.error("save failed", e);
      }
    }
    setStatus(t("status.savedMany", { saved, total: entry.files.length, dir }));
  };

  return (
    <>
      <Card variant="flat">
        <div className="flex flex-col md:flex-row gap-4 md:gap-5">
          {/* Thumbnail strip */}
          <div className="flex flex-wrap gap-2 md:w-[280px] shrink-0">
            {entry.files.map((f, i) => (
              <button
                key={f}
                onClick={() => setEnlarged(i)}
                className={cn(
                  "relative w-[60px] h-[60px] rounded-[var(--radius-sm)] overflow-hidden",
                  "border border-rule hover:border-accent transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                )}
                title={`#${i + 1}`}
              >
                {thumbs[i] ? (
                  <img src={thumbs[i]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-inset animate-pulse" />
                )}
                <span className="absolute top-0.5 left-1 font-mono text-[9px] tabular-nums bg-ink/70 text-paper px-1 rounded-sm">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </button>
            ))}
          </div>

          {/* Details + actions */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div>
              <p className="text-[13px] text-ink leading-relaxed line-clamp-3">{entry.prompt}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faded font-mono tracking-tight">
              <span className="uppercase text-accent">{entry.page}</span>
              <span>·</span>
              <span>{entry.model}</span>
              <span>·</span>
              <span>{entry.size}</span>
              <span>·</span>
              <span>{relTime(entry.timestamp, t)}</span>
              <span>·</span>
              <span className="uppercase">{entry.ext}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              <Button size="sm" variant="outline" onClick={onUsePrompt}>
                <CornerDownLeft size={12} />
                {t("historyPage.usePrompt")}
              </Button>
              <Button size="sm" variant="outline" onClick={saveAll}>
                <DownloadCloud size={12} />
                {t("historyPage.saveBatch")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                aria-label={t("historyPage.deleteOne")}
                title={t("historyPage.deleteOne")}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Lightbox */}
      {enlarged !== null && thumbs[enlarged] && (
        <Lightbox
          src={thumbs[enlarged]}
          index={enlarged}
          total={entry.files.length}
          onClose={() => setEnlarged(null)}
          onPrev={() => setEnlarged((i) => (i! > 0 ? i! - 1 : entry.files.length - 1))}
          onNext={() => setEnlarged((i) => (i! < entry.files.length - 1 ? i! + 1 : 0))}
          onSave={() => saveOne(enlarged)}
        />
      )}
    </>
  );
}

/* ─── Lightbox ───────────────────────────────────────────────────────── */

interface LightboxProps {
  src: string;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSave: () => void;
}

function Lightbox({ src, index, total, onClose, onPrev, onNext, onSave }: LightboxProps) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-ink/85 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <img
        src={src}
        alt=""
        className="max-w-full max-h-full object-contain rounded-sm shadow-2xl select-none"
        onClick={(e) => e.stopPropagation()}
      />
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-card/95 border border-rule rounded-full px-4 py-2 shadow-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-mono text-[11px] tabular-nums text-faded">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <span className="w-px h-3 bg-rule" />
        <Button size="sm" variant="ghost" onClick={onSave}>
          <Download size={12} />
          {t("historyPage.saveOne")}
        </Button>
      </div>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────── */

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-trace">
      <div className="w-14 h-14 rounded-full bg-card border border-rule flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
        <ImagePlus size={22} strokeWidth={1.5} className="text-faded" />
      </div>
      <div className="text-center">
        <div className="serif-italic text-[16px] text-faded">{t("historyPage.empty")}</div>
        <div className="text-[12px] text-trace mt-1.5">{t("historyPage.emptyHint")}</div>
      </div>
    </div>
  );
}

/* ─── Relative-time formatter ─────────────────────────────────────────── */

function relTime(ts: number, t: (k: string, v?: Record<string, unknown>) => string): string {
  const delta = (Date.now() - ts) / 1000;
  if (delta < 60) return t("historyPage.relTime.justNow");
  if (delta < 3600) return t("historyPage.relTime.minutesAgo", { n: Math.floor(delta / 60) });
  if (delta < 86400) return t("historyPage.relTime.hoursAgo", { n: Math.floor(delta / 3600) });
  if (delta < 86400 * 30) return t("historyPage.relTime.daysAgo", { n: Math.floor(delta / 86400) });
  return new Date(ts).toLocaleDateString();
}
