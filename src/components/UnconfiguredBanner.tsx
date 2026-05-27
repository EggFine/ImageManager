import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfig } from "@/services/store";
import { isConfigured } from "@/services/config";
import { useOnboarding } from "@/services/onboarding";

/**
 * Inline warning rail under the TitleBar. Renders only when:
 *   1. config has hydrated
 *   2. the user has no working api_key
 *   3. the user hasn't dismissed it for this session
 *
 * The CTA re-opens the onboarding wizard (same dialog as first-launch).
 * The X just hides it for this session so the user can keep working.
 */
export function UnconfiguredBanner() {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const ready = useConfig((s) => s.ready);
  const bannerDismissed = useOnboarding((s) => s.bannerDismissed);
  const onboarded = useConfig((s) => s.config.onboarding_completed);
  const openWizard = useOnboarding((s) => s.open);
  const dismiss = useOnboarding((s) => s.dismissBanner);

  // While the first-launch wizard is up (user hasn't been onboarded yet),
  // the banner is redundant — they're already looking at the same fields.
  if (!ready || isConfigured(cfg) || bannerDismissed || !onboarded) return null;

  return (
    <div
      role="status"
      className={cn(
        "shrink-0 px-3 md:px-5 py-2 flex items-center gap-3",
        "bg-warning/10 border-b border-warning/35",
        "animate-in fade-in-0 slide-in-from-top-1 duration-300 ease-out"
      )}
    >
      <AlertTriangle
        size={14}
        strokeWidth={1.75}
        className="text-warning shrink-0"
        aria-hidden
      />
      <span className="text-[12.5px] text-ink leading-tight flex-1 min-w-0 truncate">
        {t("banner.unconfigured")}
      </span>
      <button
        type="button"
        onClick={openWizard}
        className={cn(
          "inline-flex items-center gap-1 h-7 px-2.5 shrink-0",
          "text-[12px] font-medium text-accent hover:text-accent-strong",
          "hover:bg-accent/10 rounded-[var(--radius-sm)] transition-colors"
        )}
      >
        {t("banner.openWizard")}
        <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
      </button>
      <button
        type="button"
        aria-label={t("banner.dismiss")}
        title={t("banner.dismiss")}
        onClick={dismiss}
        className={cn(
          "inline-flex items-center justify-center shrink-0",
          "w-6 h-6 rounded-[var(--radius-sm)]",
          "text-faded hover:text-ink hover:bg-paper transition-colors"
        )}
      >
        <X size={12} />
      </button>
    </div>
  );
}
