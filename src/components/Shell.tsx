import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Home, Images, Wand2, Clock, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfig } from "../services/store";
import { isConfigured } from "../services/config";
import { useImageCache } from "../services/cacheStore";
import { useAppVersion } from "../services/version";
import { HomePage } from "../pages/HomePage";
import { GeneratePage } from "../pages/GeneratePage";
import { EditPage } from "../pages/EditPage";
import { HistoryPage } from "../pages/HistoryPage";
import { SettingsPage } from "../pages/SettingsPage";
import { TitleBar } from "./TitleBar";
import { UnconfiguredBanner } from "./UnconfiguredBanner";

export type Route = "home" | "generate" | "edit" | "history" | "settings";

interface NavBtnProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
}

/**
 * Nav button with two presentations:
 *  - default (< lg): icon-only centered, native title-tooltip carries the label
 *  - lg+         : icon + label + (xl+) kbd shortcut
 */
function NavBtn({ active, icon, label, shortcut, onClick }: NavBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative min-w-0 h-9 flex items-center",
        "rounded-[var(--radius-sm)] transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        // Collapsed (default): square-ish, icon centered
        "justify-center w-full",
        // Expanded (lg+): icon + text + kbd row
        "lg:justify-start lg:pl-3.5 lg:pr-2.5 lg:gap-3",
        active
          ? "bg-card text-ink shadow-card"
          : "text-faded hover:bg-inset/70 hover:text-ink"
      )}
    >
      {/* Active indicator — a 3×16 accent pill anchored to the button's left
          edge. Same in collapsed and expanded modes, so the visual cue is
          consistent at any sidebar width. */}
      {active && (
        <span
          aria-hidden
          className="absolute left-1 lg:left-1.5 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-accent rounded-full"
        />
      )}

      <span
        className={cn(
          "shrink-0 transition-colors",
          // small left nudge in expanded mode so text aligns nicely after accent bar
          "lg:ml-1",
          active ? "text-accent" : "text-faded group-hover:text-ink"
        )}
      >
        {icon}
      </span>

      <span className="hidden lg:block text-left text-[13.5px] font-medium tracking-[0.005em] truncate flex-1 min-w-0">
        {label}
      </span>

      {shortcut && (
        <kbd
          className={cn(
            "shrink-0 hidden xl:inline-flex items-center font-mono text-[10px] tracking-wider px-1.5 h-[18px] rounded",
            active ? "bg-inset text-faded" : "bg-paper border border-rule text-trace"
          )}
        >
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

export function Shell() {
  const { t } = useTranslation();
  const [route, setRoute] = useState<Route>("home");
  const [pendingPrompt, setPendingPrompt] = useState<{ prompt: string; page: "generate" | "edit" } | null>(null);
  const status = useConfig((s) => s.status);
  const cfg = useConfig((s) => s.config);
  const initCache = useImageCache((s) => s.init);
  const version = useAppVersion();

  // Hydrate the cache store once on app boot.
  useEffect(() => {
    void initCache();
  }, [initCache]);

  // Global shortcuts: Ctrl/Cmd+1..5 → switch route; Ctrl+, → settings
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "1") { e.preventDefault(); setRoute("home"); }
      else if (e.key === "2") { e.preventDefault(); setRoute("generate"); }
      else if (e.key === "3") { e.preventDefault(); setRoute("edit"); }
      else if (e.key === "4") { e.preventDefault(); setRoute("history"); }
      else if (e.key === "5" || e.key === ",") { e.preventDefault(); setRoute("settings"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ready = isConfigured(cfg);
  const fallback = ready
    ? t("status.ready", { url: cfg.base_url })
    : t("status.needConfig");

  return (
    <div className="grain h-full flex flex-col">
      <TitleBar />
      <UnconfiguredBanner />
      <div className="flex-1 min-h-0 flex">
        {/* Nav rail — collapses to icon-only below lg (1024px) */}
        <aside
          className={cn(
            "shrink-0 flex flex-col border-r border-rule bg-paper/50 backdrop-blur-[2px]",
            "transition-[width] duration-200 ease-out",
            "w-[56px] lg:w-[204px]"
          )}
        >
          {/* Header — expanded shows the section kicker; collapsed shows
              nothing (the brand mark is already on the TitleBar, no point
              repeating it as a mystery dot). */}
          <div
            className={cn(
              "pt-2 pb-3",
              "lg:pt-5 lg:px-5"
            )}
          >
            <span className="kicker hidden lg:inline-block">
              {t("nav.sectionLabel")}
            </span>
          </div>

          <nav className="flex flex-col gap-1 px-2">
            <NavBtn
              active={route === "home"}
              icon={<Home size={15} strokeWidth={1.75} />}
              label={t("nav.home")}
              shortcut="Ctrl 1"
              onClick={() => setRoute("home")}
            />
            <NavBtn
              active={route === "generate"}
              icon={<Images size={15} strokeWidth={1.75} />}
              label={t("nav.generate")}
              shortcut="Ctrl 2"
              onClick={() => setRoute("generate")}
            />
            <NavBtn
              active={route === "edit"}
              icon={<Wand2 size={15} strokeWidth={1.75} />}
              label={t("nav.edit")}
              shortcut="Ctrl 3"
              onClick={() => setRoute("edit")}
            />
            <NavBtn
              active={route === "history"}
              icon={<Clock size={15} strokeWidth={1.75} />}
              label={t("nav.history")}
              shortcut="Ctrl 4"
              onClick={() => setRoute("history")}
            />
          </nav>

          <div className="flex-1" />

          {/* Bottom: settings */}
          <div className="pb-3 flex flex-col gap-1 px-2">
            <div className="mx-2 lg:mx-3 my-3 h-px bg-rule/70" />
            <NavBtn
              active={route === "settings"}
              icon={<SettingsIcon size={15} strokeWidth={1.75} />}
              label={t("nav.settings")}
              shortcut="Ctrl 5"
              onClick={() => setRoute("settings")}
            />
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 overflow-y-auto px-4 md:px-7 lg:px-10 pt-4 md:pt-6 lg:pt-7 pb-6 md:pb-8 lg:pb-10 relative">
          {route === "home" && <HomePage onNavigate={setRoute} />}
          {route === "generate" && (
            <GeneratePage
              initialPrompt={pendingPrompt?.page === "generate" ? pendingPrompt.prompt : undefined}
              onConsumeInitialPrompt={() => setPendingPrompt(null)}
            />
          )}
          {route === "edit" && (
            <EditPage
              initialPrompt={pendingPrompt?.page === "edit" ? pendingPrompt.prompt : undefined}
              onConsumeInitialPrompt={() => setPendingPrompt(null)}
            />
          )}
          {route === "history" && (
            <HistoryPage
              onUsePrompt={(prompt, page) => setPendingPrompt({ prompt, page })}
              onNavigate={setRoute}
            />
          )}
          {route === "settings" && <SettingsPage />}
        </main>
      </div>

      {/* Status bar */}
      <footer className="h-7 shrink-0 border-t border-rule px-3 md:px-5 flex items-center justify-between gap-3 bg-paper/60 backdrop-blur-[2px]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              "relative block w-1.5 h-1.5 rounded-full shrink-0",
              ready ? "bg-success" : "bg-warning"
            )}
            aria-hidden
          >
            <span
              className={cn(
                "absolute inset-0 rounded-full animate-ping",
                ready ? "bg-success/60" : "bg-warning/60"
              )}
            />
          </span>
          <span className="text-[11.5px] text-faded tracking-tight truncate">
            {status || fallback}
          </span>
        </div>
        <span className="hidden md:inline text-[10.5px] text-trace font-mono tracking-wider shrink-0">
          {version ? `v${version}` : ""}
        </span>
      </footer>
    </div>
  );
}
