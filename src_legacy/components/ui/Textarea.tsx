import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, spellCheck = false, autoComplete = "off", ...props }, ref) {
    return (
      <textarea
        ref={ref}
        spellCheck={spellCheck}
        autoComplete={autoComplete}
        autoCorrect="off"
        autoCapitalize="off"
        className={cn(
          "w-full min-w-0 px-3.5 py-3",
          "bg-card border border-rule rounded-[var(--radius-sm)]",
          "text-[13.5px] leading-relaxed text-ink placeholder:text-faded/70",
          "transition-colors duration-150 resize-none",
          "hover:border-rule-strong",
          "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40",
          className
        )}
        {...props}
      />
    );
  }
);
