import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Plug, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { testConnection, type ConnectionTestResult } from "@/services/apiClient";
import { defaultConfig } from "@/services/config";
import { useConfig } from "@/services/store";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  /** Called when the user dismisses (skip / finish / esc).  */
  onComplete: () => void;
}

/**
 * First-launch wizard. Shown over Shell when `cfg.onboarding_completed`
 * is false. Collects `base_url` + `api_key`, lets the user probe the
 * endpoint, and persists them on Finish.
 */
export function OnboardingDialog({ open, onComplete }: Props) {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const update = useConfig((s) => s.update);
  const { push } = useToast();

  // Local draft state — we don't write to cfg until the user clicks Finish,
  // so they can experiment without polluting the persisted config.
  const [baseUrl, setBaseUrl] = useState(cfg.base_url || defaultConfig.base_url);
  const [apiKey, setApiKey] = useState(cfg.api_key);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [finishing, setFinishing] = useState(false);

  const handleTest = async () => {
    if (!baseUrl.trim() || !apiKey.trim()) {
      push({ title: t("onboarding.needsBoth"), intent: "warn" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await testConnection({ ...cfg, base_url: baseUrl.trim(), api_key: apiKey.trim() });
    setTestResult(result);
    setTesting(false);
  };

  const handleFinish = async () => {
    if (!baseUrl.trim() && !apiKey.trim()) {
      // User typed nothing — that's the same as Skip.
      handleSkip();
      return;
    }
    setFinishing(true);
    await update({
      base_url: baseUrl.trim(),
      api_key: apiKey.trim(),
      onboarding_completed: true,
    });
    setFinishing(false);
    onComplete();
  };

  const handleSkip = async () => {
    // Persist *only* the flag; leave any draft values on the form unsaved
    // (the user explicitly said "later").
    await update({ onboarding_completed: true });
    onComplete();
  };

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[150] bg-ink/55 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-300"
          )}
        />
        <Dialog.Content
          // Escape & outside-click are intentionally NOT auto-closing — the
          // user must take action (Finish or Skip).
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[151]",
            "w-[min(560px,calc(100vw-32px))] max-h-[calc(100vh-48px)] overflow-y-auto",
            "rounded-[var(--radius)] bg-card border border-rule shadow-card-hover",
            "p-6 md:p-8",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=open]:slide-in-from-bottom-2 duration-400 ease-out"
          )}
        >
          {/* Editorial masthead */}
          <div className="flex items-center gap-2.5 mb-4">
            <span className="amber-rule" />
            <span className="kicker">{t("onboarding.eyebrow")}</span>
          </div>

          <Dialog.Title asChild>
            <h2 className="font-display font-medium leading-[0.96] tracking-[-0.025em] mb-1">
              <span className="block text-[38px] text-ink">
                {t("onboarding.title")}
              </span>
              <span className="block text-[26px] text-muted">
                <span className="serif-italic font-normal">{t("onboarding.subtitle")}</span>
              </span>
            </h2>
          </Dialog.Title>

          <Dialog.Description asChild>
            <p className="text-[13.5px] text-faded mt-3 mb-6 leading-relaxed">
              {t("onboarding.body")}
            </p>
          </Dialog.Description>

          {/* Form */}
          <div className="flex flex-col gap-4">
            <Field>
              <Label>{t("onboarding.baseUrlLabel")}</Label>
              <Input
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setTestResult(null);
                }}
                placeholder="https://api.openai.com/v1"
                mono
                autoFocus
              />
              <p className="text-[11px] text-faded/90 mt-1.5">{t("onboarding.baseUrlHint")}</p>
            </Field>

            <Field>
              <Label>{t("onboarding.apiKeyLabel")}</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="sk-..."
                mono
              />
              <p className="text-[11px] text-faded/90 mt-1.5">{t("onboarding.apiKeyHint")}</p>
            </Field>

            {/* Test row */}
            <div className="flex items-center gap-3 mt-1">
              <Button
                variant="outline"
                onClick={handleTest}
                loading={testing}
                disabled={!baseUrl.trim() || !apiKey.trim() || finishing}
              >
                <Plug size={13} />
                {testing ? t("settings.testing") : t("onboarding.test")}
              </Button>

              {testResult && (
                <div
                  className={cn(
                    "flex items-center gap-2 text-[12.5px] animate-in fade-in-0 slide-in-from-left-1 duration-300",
                    testResult.ok ? "text-success" : "text-danger"
                  )}
                >
                  {testResult.ok ? (
                    <CheckCircle2 size={14} strokeWidth={2} />
                  ) : (
                    <AlertCircle size={14} strokeWidth={2} />
                  )}
                  <span>
                    {testResult.ok
                      ? testResult.modelCount !== undefined
                        ? t("settings.testModels", { count: testResult.modelCount })
                        : t("settings.testOk")
                      : testResult.message}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-7 pt-5 border-t border-rule flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={handleSkip}>
              {t("onboarding.skip")}
            </Button>
            <Button
              variant="primary"
              onClick={handleFinish}
              loading={finishing}
              disabled={testing}
            >
              {!baseUrl.trim() && !apiKey.trim()
                ? t("onboarding.skip")
                : testResult?.ok || testResult === null
                ? t("onboarding.finish")
                : t("onboarding.finishUntested")}
              <ArrowRight size={13} />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
