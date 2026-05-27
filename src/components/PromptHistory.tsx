import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { History, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHistory, type HistoryPage } from "@/services/history";

interface Props {
  /** Which page is asking — filters history to entries from the same page. */
  page: HistoryPage;
  /** Called when the user picks an entry. */
  onPick: (prompt: string) => void;
}

/** Small popover button that surfaces the most recent prompts. Sits in the
 *  Card eyebrow row next to the character counter. */
export function PromptHistory({ page, onPick }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const history = useHistory((s) => s.history);
  const remove = useHistory((s) => s.remove);
  const clear = useHistory((s) => s.clear);

  // Show same-page entries first, then everything else as faded fallback.
  const samePage = history.filter((e) => e.page === page);
  const otherPage = history.filter((e) => e.page !== page);
  const list = [...samePage, ...otherPage].slice(0, 30);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("history.openLabel")}
        title={t("history.openLabel")}
        className={cn(
          "inline-flex items-center gap-1 h-[18px] px-1.5 rounded text-[10.5px] font-mono tracking-wider",
          "transition-colors duration-150",
          open
            ? "bg-inset text-ink"
            : "text-trace hover:text-ink hover:bg-inset/60"
        )}
      >
        <History size={11} strokeWidth={1.75} />
        <span className="tabular-nums">{history.length}</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("history.popoverLabel")}
          className={cn(
            "absolute z-50 mt-1.5 right-0 w-[320px] max-h-[360px] overflow-hidden",
            "bg-card border border-rule rounded-[var(--radius)] shadow-card-hover",
            "flex flex-col"
          )}
        >
          <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-rule">
            <span className="eyebrow">{t("history.title")}</span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => clear()}
                className="inline-flex items-center gap-1 text-[11px] text-faded hover:text-danger transition-colors"
              >
                <Trash2 size={11} />
                {t("history.clear")}
              </button>
            )}
          </div>

          {list.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <div className="serif-italic text-[13px] text-faded">{t("history.empty")}</div>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto py-1">
              {list.map((entry) => {
                const dim = entry.page !== page;
                return (
                  <li key={entry.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        onPick(entry.prompt);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 pr-8 transition-colors",
                        "hover:bg-inset/70"
                      )}
                    >
                      <div className={cn(
                        "text-[12.5px] leading-snug line-clamp-2",
                        dim ? "text-faded" : "text-ink"
                      )}>
                        {entry.prompt}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[10px] tracking-wider text-trace uppercase">
                          {entry.page === "generate" ? "gen" : "edit"}
                        </span>
                        <span className="font-mono text-[10px] text-trace">·</span>
                        <span className="text-[10.5px] text-trace">{relativeTime(entry.ts)}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={t("history.removeEntry")}
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(entry.id);
                      }}
                      className={cn(
                        "absolute top-2 right-2 w-5 h-5 inline-flex items-center justify-center rounded",
                        "text-trace hover:text-danger hover:bg-paper",
                        "opacity-0 group-hover:opacity-100 transition-opacity"
                      )}
                    >
                      <X size={11} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Lightweight relative-time formatter so we don't pull in date-fns. */
function relativeTime(ts: number): string {
  const delta = (Date.now() - ts) / 1000;
  if (delta < 60) return `${Math.floor(delta)}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  if (delta < 86400 * 7) return `${Math.floor(delta / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}
