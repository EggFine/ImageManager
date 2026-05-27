import { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props extends LabelHTMLAttributes<HTMLLabelElement> {
  hint?: ReactNode;
}

/**
 * Form-field label.
 * Uses the `.eyebrow` editorial primitive, which already neutralizes
 * uppercase + wide letter-spacing under :lang(zh) (see globals.css).
 */
export function Label({ className, hint, children, ...props }: Props) {
  return (
    <label
      className={cn("eyebrow flex items-center justify-between gap-2 mb-1.5", className)}
      {...props}
    >
      <span>{children}</span>
      {hint && (
        <span className="normal-case tracking-normal text-trace font-sans text-[11px]">
          {hint}
        </span>
      )}
    </label>
  );
}

export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col", className)}>{children}</div>;
}
