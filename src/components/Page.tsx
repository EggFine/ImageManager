import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageProps {
  title: string;
  desc?: string;
  /** Optional element on the right of the page header */
  trailing?: ReactNode;
  children: ReactNode;
}

export function Page({ title, desc, trailing, children }: PageProps) {
  return (
    <div className="max-w-[1280px] 2xl:max-w-[1440px] mx-auto w-full flex flex-col gap-4 md:gap-5 lg:gap-6">
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
            <p className="text-[12px] md:text-[12.5px] lg:text-[13px] text-faded max-w-[640px] leading-relaxed font-sans">
              {desc}
            </p>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </header>
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
}

/**
 * Card: a labelled surface with soft elevation.
 * The eyebrow label sits ABOVE the card border so the card body stays clean.
 */
export function Card({ label, labelTrailing, children, className, noPadding }: CardProps) {
  return (
    <section className={cn("flex flex-col gap-1.5 md:gap-2", className)}>
      {(label || labelTrailing) && (
        <div className="flex items-center justify-between gap-2 px-1.5">
          {label && <span className="eyebrow">{label}</span>}
          {labelTrailing && <div className="shrink-0">{labelTrailing}</div>}
        </div>
      )}
      <div
        className={cn(
          "rounded-[var(--radius)] border border-rule/80 bg-card shadow-card",
          "transition-colors duration-200",
          "focus-within:border-rule-strong",
          !noPadding && "p-3.5 md:p-4 lg:p-5"
        )}
      >
        {children}
      </div>
    </section>
  );
}
