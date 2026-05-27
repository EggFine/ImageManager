import * as RSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface SelectProps {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function Select({ value, onValueChange, placeholder, disabled, className, children }: SelectProps) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RSelect.Trigger
        className={cn(
          "w-full min-w-0 h-9 px-3 pr-2",
          "bg-card border border-rule rounded-[var(--radius-sm)]",
          "flex items-center justify-between gap-2",
          "text-[13px] text-ink",
          "transition-colors duration-150",
          "hover:border-rule-strong",
          "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40",
          "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
          "data-[state=open]:border-accent data-[state=open]:ring-1 data-[state=open]:ring-accent/40",
          className
        )}
      >
        <RSelect.Value placeholder={placeholder} className="truncate" />
        <RSelect.Icon className="text-faded shrink-0">
          <ChevronDown size={14} className="transition-transform data-[state=open]:rotate-180" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-[200] min-w-[var(--radix-select-trigger-width)] max-h-[280px] overflow-hidden",
            "bg-card border border-rule rounded-[var(--radius)]",
            "shadow-popover",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          )}
        >
          <RSelect.Viewport className="p-1">{children}</RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}

export const SelectItem = forwardRef<
  HTMLDivElement,
  { value: string; children: ReactNode; className?: string }
>(function SelectItem({ value, children, className }, ref) {
  return (
    <RSelect.Item
      ref={ref}
      value={value}
      className={cn(
        "relative flex items-center px-2.5 py-1.5 rounded-[var(--radius-sm)]",
        "text-[13px] text-muted cursor-default select-none outline-none",
        "data-[highlighted]:bg-raised data-[highlighted]:text-ink",
        "data-[state=checked]:text-accent data-[state=checked]:font-medium",
        className
      )}
    >
      <span className="w-4 mr-1 flex justify-center text-accent">
        <RSelect.ItemIndicator>
          <Check size={12} strokeWidth={2.5} />
        </RSelect.ItemIndicator>
      </span>
      <RSelect.ItemText>{children}</RSelect.ItemText>
    </RSelect.Item>
  );
});
