import * as RToast from "@radix-ui/react-toast";
import { X, AlertCircle, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { ReactNode, createContext, useCallback, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type Intent = "info" | "warn" | "error" | "ok";
interface ToastEntry {
  id: number;
  title: string;
  body?: string;
  intent: Intent;
}

interface Ctx {
  push: (t: Omit<ToastEntry, "id">) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast outside provider");
  return ctx;
}

const icons: Record<Intent, ReactNode> = {
  info: <Info size={14} strokeWidth={2} />,
  warn: <AlertTriangle size={14} strokeWidth={2} />,
  error: <AlertCircle size={14} strokeWidth={2} />,
  ok: <CheckCircle2 size={14} strokeWidth={2} />,
};

const intentClass: Record<Intent, string> = {
  info: "border-l-[3px] border-l-faded border-rule",
  warn: "border-l-[3px] border-l-warning border-rule",
  error: "border-l-[3px] border-l-danger border-rule",
  ok: "border-l-[3px] border-l-success border-rule",
};

const intentIconClass: Record<Intent, string> = {
  info: "text-faded",
  warn: "text-warning",
  error: "text-danger",
  ok: "text-success",
};

let _seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [list, setList] = useState<ToastEntry[]>([]);

  const push = useCallback((t: Omit<ToastEntry, "id">) => {
    const id = ++_seq;
    setList((l) => [...l, { ...t, id }]);
  }, []);

  const remove = (id: number) => setList((l) => l.filter((x) => x.id !== id));

  return (
    <ToastCtx.Provider value={{ push }}>
      <RToast.Provider swipeDirection="right" duration={5000}>
        {children}
        {list.map((toast) => (
          <RToast.Root
            key={toast.id}
            onOpenChange={(o) => !o && remove(toast.id)}
            className={cn(
              "bg-card border rounded-[var(--radius)] p-3.5 pr-10",
              "shadow-popover",
              "data-[state=open]:animate-in data-[state=open]:slide-in-from-right-4 data-[state=open]:fade-in-0",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-50 data-[state=closed]:slide-out-to-right-4",
              "relative",
              intentClass[toast.intent]
            )}
          >
            <div className="flex items-start gap-2.5">
              <span className={cn("mt-0.5 shrink-0", intentIconClass[toast.intent])}>
                {icons[toast.intent]}
              </span>
              <div className="min-w-0 flex-1">
                <RToast.Title className="text-[13px] font-medium text-ink leading-tight">
                  {toast.title}
                </RToast.Title>
                {toast.body && (
                  <RToast.Description className="mt-1 text-[12px] text-faded leading-snug break-words">
                    {toast.body}
                  </RToast.Description>
                )}
              </div>
            </div>
            <RToast.Close
              className="absolute top-2 right-2 text-faded hover:text-ink hover:bg-inset p-1.5 rounded-sm transition-colors"
              aria-label={t("a11y.closeNotice")}
            >
              <X size={12} />
            </RToast.Close>
          </RToast.Root>
        ))}
        <RToast.Viewport className="fixed bottom-9 md:bottom-10 right-3 md:right-6 z-[100] flex flex-col gap-2 w-[calc(100vw-72px)] md:w-[380px] md:max-w-[calc(100vw-48px)] outline-none" />
      </RToast.Provider>
    </ToastCtx.Provider>
  );
}
