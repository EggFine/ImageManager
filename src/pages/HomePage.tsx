import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Images,
  Wand2,
  ArrowRight,
  CircleDot,
  Server,
  Palette,
  Zap,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfig } from "@/services/store";
import { isConfigured } from "@/services/config";

type Route = "home" | "generate" | "edit" | "settings";

interface Props {
  onNavigate: (r: Route) => void;
}

function useTimeGreeting(): string {
  const { t } = useTranslation();
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return t("home.greetMorning");
  if (hour >= 12 && hour < 18) return t("home.greetAfternoon");
  if (hour >= 18 && hour < 23) return t("home.greetEvening");
  return t("home.greetNight");
}

export function HomePage({ onNavigate }: Props) {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const ready = isConfigured(cfg);
  const greeting = useTimeGreeting();

  const themeLabel =
    cfg.theme === "system"
      ? t("home.status.themeSystem")
      : cfg.theme === "light"
      ? t("home.status.themeLight")
      : t("home.status.themeDark");

  return (
    <div className="max-w-[1280px] 2xl:max-w-[1440px] mx-auto w-full flex flex-col gap-6 md:gap-8 lg:gap-10">
      {/* Editorial masthead */}
      <header className="relative pt-0 md:pt-2 lg:pt-3">
        <div className="kicker flex items-center gap-2 md:gap-2.5 flex-wrap">
          <span className="amber-rule shrink-0" />
          <span>{greeting}</span>
          <span className="text-decor">·</span>
          <span>v0.1</span>
          <span className="text-decor hidden md:inline">·</span>
          <span className="hidden md:inline">OpenAI compatible</span>
        </div>

        {/* The slogan — bottom-of-clamp 40px lets it breathe at min window */}
        <h1 className="font-display font-medium leading-[0.94] tracking-[-0.028em] mt-3 md:mt-5">
          <span className="block text-[clamp(40px,8vw,96px)] text-ink">
            Hi<span className="text-accent">.</span>
          </span>
          <span className="block text-[clamp(28px,5.6vw,64px)] text-muted mt-1 md:mt-1.5">
            <span className="italic font-normal">I&rsquo;m </span>
            <span className="text-ink">ImageManager</span>
            <span className="text-accent">.</span>
          </span>
        </h1>

        <p className="mt-4 md:mt-6 text-[13px] md:text-[14px] lg:text-[14.5px] text-faded max-w-[540px] leading-relaxed">
          {t("home.tagline")}
        </p>

        {/* Decorative editorial corner mark — only on wider screens */}
        <div
          className="hidden lg:block absolute top-3 right-2 text-right"
          aria-hidden
        >
          <div className="font-display italic text-[14px] text-trace leading-tight">
            Vol. <span className="not-italic font-mono tabular-nums">001</span>
          </div>
          <div className="font-mono text-[10px] tracking-[0.18em] text-decor mt-1">
            {new Date().toISOString().slice(0, 10)}
          </div>
        </div>
      </header>

      {/* Workflow cards */}
      <section className="flex flex-col gap-3">
        <div className="eyebrow px-1.5">{t("home.workflowsLabel")}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 lg:gap-5">
          <ActionCard
            icon={<Images size={22} strokeWidth={1.75} />}
            number="01"
            title={t("nav.generate")}
            desc={t("gen.desc")}
            shortcut="Ctrl 2"
            onClick={() => onNavigate("generate")}
          />
          <ActionCard
            icon={<Wand2 size={22} strokeWidth={1.75} />}
            number="02"
            title={t("nav.edit")}
            desc={t("edit.desc")}
            shortcut="Ctrl 3"
            onClick={() => onNavigate("edit")}
          />
        </div>
      </section>

      {/* Status snapshot */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 px-1.5">
          <span className="eyebrow">{t("home.statusLabel")}</span>
          {!ready && (
            <button
              onClick={() => onNavigate("settings")}
              className="text-[11.5px] text-accent hover:text-accent-strong transition-colors inline-flex items-center gap-1 group shrink-0"
            >
              <SettingsIcon size={11} />
              <span className="hidden md:inline">{t("home.gotoSettings")}</span>
              <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <StatusChip
            icon={<CircleDot size={14} strokeWidth={2} />}
            label={t("home.status.api")}
            value={ready ? t("home.status.ready") : t("home.status.needConfig")}
            tone={ready ? "ok" : "warn"}
          />
          <StatusChip
            icon={<Server size={14} strokeWidth={1.75} />}
            label={t("home.status.model")}
            value={cfg.generation_model || "—"}
            mono
          />
          <StatusChip
            icon={<Palette size={14} strokeWidth={1.75} />}
            label={t("home.status.theme")}
            value={themeLabel}
          />
          <StatusChip
            icon={<Zap size={14} strokeWidth={1.75} />}
            label={t("home.status.stream")}
            value={cfg.stream ? t("common.on") : t("common.off")}
            tone={cfg.stream ? "ok" : "neutral"}
          />
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

interface ActionCardProps {
  icon: ReactNode;
  number: string;
  title: string;
  desc: string;
  shortcut: string;
  onClick: () => void;
}

function ActionCard({ icon, number, title, desc, shortcut, onClick }: ActionCardProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative text-left w-full overflow-hidden",
        "rounded-[var(--radius)] border border-rule/80 bg-card shadow-card",
        "p-4 md:p-5 lg:p-6 transition-all duration-200",
        "hover:shadow-card-hover hover:border-rule-strong hover:-translate-y-0.5",
        "active:translate-y-0 active:shadow-card",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      )}
    >
      {/* Warm corner glow on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-accent/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-3xl"
      />

      {/* Top row: icon + shortcut + number */}
      <div className="relative flex items-start justify-between mb-4 md:mb-5 lg:mb-6">
        <div
          className={cn(
            "w-9 h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-[var(--radius-sm)] flex items-center justify-center text-accent",
            "bg-accent-soft/55 border border-accent/15",
            "transition-transform duration-200 group-hover:scale-105"
          )}
        >
          {icon}
        </div>
        <div className="flex items-center gap-2">
          <kbd className="hidden md:inline-flex items-center font-mono text-[10.5px] tracking-wider px-1.5 h-[18px] rounded bg-inset text-faded">
            {shortcut}
          </kbd>
          <span className="font-mono text-[10.5px] text-decor tabular-nums tracking-[0.18em]">
            {number}
          </span>
        </div>
      </div>

      <h3
        className={cn(
          "font-display font-medium leading-tight tracking-[-0.018em] text-ink mb-1.5",
          "text-[22px] md:text-[24px] lg:text-[26px] xl:text-[28px]"
        )}
      >
        {title}
      </h3>

      <p className="text-[12.5px] text-faded leading-relaxed line-clamp-2 mb-4 md:mb-5 lg:mb-6">
        {desc}
      </p>

      <div className="flex items-center gap-1.5 text-[12px] text-faded group-hover:text-accent transition-colors">
        <span className="font-medium tracking-tight">{t("home.open")}</span>
        <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

interface StatusChipProps {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "warn" | "neutral";
  mono?: boolean;
}

function StatusChip({ icon, label, value, tone, mono }: StatusChipProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 md:px-3.5 py-2.5 md:py-3 rounded-[var(--radius)]",
        "border border-rule/70 bg-card shadow-card",
        "transition-colors duration-150"
      )}
    >
      <span
        className={cn(
          "shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center",
          tone === "ok"
            ? "bg-success/15 text-success"
            : tone === "warn"
            ? "bg-warning/15 text-warning"
            : tone === "neutral"
            ? "bg-inset text-trace"
            : "bg-inset text-faded"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="eyebrow leading-tight text-trace">{label}</div>
        <div
          className={cn(
            "text-[12.5px] md:text-[13px] text-ink truncate font-medium mt-0.5 tracking-tight",
            mono && "font-mono text-[12px] md:text-[12.5px]"
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
