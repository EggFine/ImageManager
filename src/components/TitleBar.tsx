import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "@tauri-apps/plugin-os";
import { Minus, Square, Copy, X, Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfig } from "@/services/store";

const appWindow = getCurrentWindow();

/** macOS shows native traffic-light buttons (configured via `titleBarStyle: "Overlay"`
 *  + `hiddenTitle: true` in tauri.conf.json), so we suppress our custom Min/Max/Close. */
const IS_MACOS = platform() === "macos";

function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useConfig((s) => s.config.theme);
  const update = useConfig((s) => s.update);
  const next: typeof theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => update({ theme: next })}
      aria-label={t("titlebar.theme", { mode: theme })}
      className="h-8 w-[46px] inline-flex items-center justify-center text-faded hover:text-ink hover:bg-inset transition-colors"
      title={t("titlebar.theme", { mode: theme })}
    >
      <Icon size={13} strokeWidth={1.75} />
    </button>
  );
}

function WinControls() {
  const { t } = useTranslation();
  const [isMax, setMax] = useState(false);

  useEffect(() => {
    let unlisten: undefined | (() => void);
    appWindow.isMaximized().then(setMax);
    appWindow.onResized(async () => setMax(await appWindow.isMaximized()))
      .then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={() => appWindow.minimize()}
        aria-label={t("titlebar.minimize")}
        title={t("titlebar.minimize")}
        className="w-[46px] h-8 inline-flex items-center justify-center text-faded hover:text-ink hover:bg-inset transition-colors"
      >
        <Minus size={13} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={() => appWindow.toggleMaximize()}
        aria-label={isMax ? t("titlebar.restore") : t("titlebar.maximize")}
        title={isMax ? t("titlebar.restore") : t("titlebar.maximize")}
        className="w-[46px] h-8 inline-flex items-center justify-center text-faded hover:text-ink hover:bg-inset transition-colors"
      >
        {isMax ? <Copy size={12} strokeWidth={1.5} /> : <Square size={11} strokeWidth={1.5} />}
      </button>
      <button
        type="button"
        onClick={() => appWindow.close()}
        aria-label={t("titlebar.close")}
        title={t("titlebar.close")}
        className={cn(
          "w-[46px] h-8 inline-flex items-center justify-center text-faded transition-colors",
          "hover:!text-[color:var(--close-hover-fg)] hover:!bg-[color:var(--close-hover)]"
        )}
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}

interface Props {
  className?: string;
}

export function TitleBar({ className }: Props) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "h-8 shrink-0 flex items-stretch bg-paper border-b border-rule select-none",
        className
      )}
    >
      {/* Drag region — fills available space.
          On macOS, leave room for the native traffic-light buttons on the left. */}
      <div
        data-tauri-drag-region
        className={cn(
          "flex-1 min-w-0 flex items-center px-3 md:px-4 gap-2 md:gap-2.5",
          IS_MACOS && "pl-[78px]"
        )}
      >
        <span data-tauri-drag-region className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
        <span
          data-tauri-drag-region
          className="font-mono text-[11px] tracking-[0.12em] uppercase text-faded truncate"
        >
          {t("app.title")}
        </span>
        <span data-tauri-drag-region className="hidden md:inline text-decor text-[11px]">·</span>
        <span
          data-tauri-drag-region
          className="hidden md:inline serif-italic text-[12px] text-trace truncate"
        >
          {t("app.tagline")}
        </span>
      </div>

      <ThemeToggle />

      {!IS_MACOS && (
        <>
          <div className="w-px self-stretch bg-rule my-1.5" />
          <WinControls />
        </>
      )}
    </div>
  );
}
