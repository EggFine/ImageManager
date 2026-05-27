import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, mono, invalid, spellCheck = false, autoComplete = "off", ...props },
  ref
) {
  return (
    <input
      ref={ref}
      spellCheck={spellCheck}
      autoComplete={autoComplete}
      autoCorrect="off"
      autoCapitalize="off"
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full min-w-0 h-9 px-3",
        "bg-card border border-rule rounded-[var(--radius-sm)]",
        "text-[13px] text-ink placeholder:text-faded/70",
        "transition-colors duration-150",
        "hover:border-rule-strong",
        "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "read-only:bg-inset read-only:text-muted read-only:border-rule-strong/60 read-only:hover:border-rule-strong/60 read-only:cursor-default",
        invalid && "border-danger focus:border-danger focus:ring-danger/40",
        mono && "font-mono",
        className
      )}
      {...props}
    />
  );
});
