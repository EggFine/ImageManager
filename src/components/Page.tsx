import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageProps {
  /** Standard h1 page title. Mutually exclusive with `hero`. */
  title?: string;
  desc?: string;
  /** Optional element on the right of the page header */
  trailing?: ReactNode;
  /** Custom hero block — replaces the default `<h1>` header entirely.
   *  Use for editorial / landing pages with non-standard masthead. */
  hero?: ReactNode;
  /** Section spacing rhythm. `normal` is for utility pages, `loose` for
   *  landing-style pages where sections want room to breathe. */
  spacing?: "normal" | "loose";
  /** Pages that orchestrate their own entry animation (e.g. HomePage's
   *  staggered hero) should opt out of the default page-level fade. */
  disableEntryAnimation?: boolean;
  children: ReactNode;
}

const SPACING_CLASS: Record<NonNullable<PageProps["spacing"]>, string> = {
  normal: "gap-4 md:gap-5 lg:gap-6",
  loose: "gap-6 md:gap-8 lg:gap-10",
};

export function Page({
  title,
  desc,
  trailing,
  hero,
  spacing = "normal",
  disableEntryAnimation,
  children,
}: PageProps) {
  return (
    <div
      className={cn(
        "max-w-[1280px] 2xl:max-w-[1440px] mx-auto w-full flex flex-col",
        SPACING_CLASS[spacing],
        // Page-level enter animation — fires every time the user switches
        // routes (Shell unmounts the previous page, mounts this one).
        !disableEntryAnimation && "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-out"
      )}
    >
      {hero ?? (title && (
        <header className="flex items-end justify-between gap-3 md:gap-6 pt-1">
          <div className="flex flex-col gap-1 md:gap-1.5 lg:gap-2 min-w-0">
            <h1
              className={cn(
                "font-display font-medium text-ink leading-[1.1] tracking-[-0.018em]",
                "text-[22px] md:text-[26px] lg:text-[30px] xl:text-[32px]"
              )}
            >
              {title}
            </h1>
            {desc && (
              <p className="text-label text-faded max-w-[640px] leading-relaxed font-sans">
                {desc}
              </p>
            )}
          </div>
          {trailing && <div className="shrink-0">{trailing}</div>}
        </header>
      ))}
      {children}
    </div>
  );
}

interface CardProps {
  /** Eyebrow label shown above the card (e.g. "Prompt"). */
  label?: string;
  /** Optional trailing element placed on the same row as the label. */
  labelTrailing?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Strip default inner padding when you need to control it from within. */
  noPadding?: boolean;
  /** Surface treatment.
   *    elevated — soft drop-shadow + border (default).
   *    flat     — border only; for dense lists where every card stacked with
   *               its own shadow becomes visual noise. */
  variant?: "elevated" | "flat";
}

const VARIANT_CLASS: Record<NonNullable<CardProps["variant"]>, string> = {
  elevated: "border border-rule bg-card shadow-card",
  flat: "border border-rule bg-card",
};

/**
 * Card: a labelled surface.
 * The eyebrow label sits ABOVE the card border so the card body stays clean.
 */
export function Card({
  label,
  labelTrailing,
  children,
  className,
  noPadding,
  variant = "elevated",
}: CardProps) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      {(label || labelTrailing) && (
        <div className="flex items-center justify-between gap-2 px-1.5">
          {label && <span className="eyebrow">{label}</span>}
          {labelTrailing && <div className="shrink-0">{labelTrailing}</div>}
        </div>
      )}
      <div
        className={cn(
          "rounded-[var(--radius)]",
          VARIANT_CLASS[variant],
          "transition-colors duration-200",
          "focus-within:border-rule-strong",
          !noPadding && "p-4 md:p-5"
        )}
      >
        {children}
      </div>
    </section>
  );
}
