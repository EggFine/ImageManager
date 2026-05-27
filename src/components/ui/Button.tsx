import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink border border-accent shadow-accent " +
    "hover:bg-accent-strong hover:border-accent-strong hover:shadow-accent-hover " +
    "active:brightness-90 active:scale-[0.985]",
  outline:
    "bg-card border border-rule text-ink " +
    "hover:bg-inset hover:border-rule-strong " +
    "active:bg-raised active:scale-[0.985]",
  ghost:
    "bg-transparent border border-transparent text-muted " +
    "hover:bg-inset hover:text-ink " +
    "active:bg-raised active:scale-[0.985]",
  danger:
    "bg-danger text-white border border-danger " +
    "hover:brightness-95 active:brightness-90 active:scale-[0.985]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12px]",
  md: "h-9 px-4 text-[13px]",
  lg: "h-11 px-6 text-[13.5px]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "outline", size = "md", className, children, loading, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 select-none whitespace-nowrap",
        "font-sans font-medium tracking-[0.01em]",
        "rounded-[var(--radius-sm)] transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
