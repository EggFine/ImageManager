import * as RSwitch from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

interface Props {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export function Switch({ checked, onCheckedChange, disabled, className, id, ...rest }: Props) {
  return (
    <RSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={rest["aria-label"]}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center",
        "rounded-full border border-rule bg-inset",
        "transition-colors duration-200",
        "data-[state=checked]:bg-accent data-[state=checked]:border-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        className
      )}
    >
      <RSwitch.Thumb
        className={cn(
          "pointer-events-none block h-3.5 w-3.5 rounded-full",
          "bg-card shadow-[0_1px_2px_rgba(0,0,0,0.25)] border border-rule-strong/40",
          "transition-transform duration-200 ease-out",
          "translate-x-0.5",
          "data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-ink data-[state=checked]:border-transparent"
        )}
      />
    </RSwitch.Root>
  );
}
