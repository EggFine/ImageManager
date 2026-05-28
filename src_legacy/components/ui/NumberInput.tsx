import { ChevronUp, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  id?: string;
}

export function NumberInput({ value, onChange, min = 0, max = 999, step = 1, className, id }: Props) {
  const { t } = useTranslation();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div
      className={cn(
        "flex items-stretch w-full min-w-0 h-9",
        "bg-card border border-rule rounded-[var(--radius-sm)]",
        "transition-colors duration-150",
        "hover:border-rule-strong focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/40",
        className
      )}
    >
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        className="flex-1 min-w-0 h-full px-3 bg-transparent outline-none font-mono text-[13px] text-ink [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <div className="flex flex-col h-full border-l border-rule shrink-0">
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("a11y.increase")}
          className="flex-1 w-7 inline-flex items-center justify-center text-faded hover:bg-inset hover:text-ink active:bg-raised transition-colors"
          onClick={() => onChange(clamp(value + step))}
        >
          <ChevronUp size={12} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("a11y.decrease")}
          className="flex-1 w-7 inline-flex items-center justify-center text-faded hover:bg-inset hover:text-ink active:bg-raised transition-colors border-t border-rule"
          onClick={() => onChange(clamp(value - step))}
        >
          <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
}
