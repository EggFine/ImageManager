import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HintProps extends HTMLAttributes<HTMLParagraphElement> {
  /** Semantic tone — affects color only. Default is neutral grey. */
  tone?: "neutral" | "warning" | "danger";
  children: ReactNode;
}

const TONE_CLASS: Record<NonNullable<HintProps["tone"]>, string> = {
  neutral: "text-faded/90",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * Small secondary-explanation text. Use under form fields, callouts, etc.
 * Replaces the ~10 places that all wrote
 * `<p className="text-[11.5px] text-faded/90 mt-2">…</p>` by hand.
 */
export function Hint({ tone = "neutral", className, children, ...rest }: HintProps) {
  return (
    <p className={cn("text-meta", TONE_CLASS[tone], className)} {...rest}>
      {children}
    </p>
  );
}
