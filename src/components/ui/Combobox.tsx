import { useEffect, useId, useRef, useState, KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

/**
 * Editable combobox: free text input + suggestion dropdown.
 * Full keyboard support (Up/Down/Enter/Esc/Home/End) and ARIA combobox pattern.
 */
export function Combobox({ value, onChange, options, placeholder, className }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  // Scroll active option into view
  useEffect(() => {
    if (!open || active < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(options.length - 1, a < 0 ? 0 : a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.max(0, a < 0 ? options.length - 1 : a - 1));
    } else if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault();
      commit(options[active]);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setActive(options.length - 1);
    }
  };

  return (
    <div ref={ref} className={cn("relative w-full min-w-0", className)}>
      <div className="relative">
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-opt-${active}` : undefined}
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full h-9 px-3 pr-8 font-mono text-[13px]",
            "bg-card border border-rule rounded-[var(--radius-sm)]",
            "text-ink placeholder:text-faded/70",
            "transition-colors duration-150",
            "hover:border-rule-strong",
            "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40"
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("a11y.expandOptions")}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-faded hover:text-ink p-1.5 rounded-sm hover:bg-inset"
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && options.length > 0 && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          className={cn(
            "absolute z-50 mt-1 w-full max-h-56 overflow-auto",
            "bg-card border border-rule rounded-[var(--radius)]",
            "shadow-lg shadow-black/15 dark:shadow-black/40 p-1"
          )}
        >
          {options.map((opt, idx) => (
            <button
              key={opt}
              id={`${listId}-opt-${idx}`}
              data-idx={idx}
              role="option"
              aria-selected={opt === value}
              type="button"
              onMouseEnter={() => setActive(idx)}
              onClick={() => commit(opt)}
              className={cn(
                "w-full text-left px-2.5 py-1.5 rounded-[var(--radius-sm)] font-mono text-[13px]",
                "text-muted",
                idx === active ? "bg-raised text-ink" : "hover:bg-inset",
                opt === value && "text-accent"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
