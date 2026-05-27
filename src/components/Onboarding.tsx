import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Plug, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Select, SelectItem } from "@/components/ui/Select";
import { Hint } from "@/components/ui/Hint";
import { testConnection } from "@/services/apiClient";
import type { ConnectionTestResult } from "@/services/apiClientTypes";
import { useConfig } from "@/services/store";
import { useToast } from "@/components/ui/Toast";
import {
  DEFAULT_BASE_URL,
  ENDPOINT_TYPE_LABEL,
  PRESET_MODELS,
  type EndpointType,
} from "@/services/presets";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  /** Fires when the user dismisses (skip / finish / esc). */
  onComplete: () => void;
}

type Step = 1 | 2;

/**
 * Two-step first-launch wizard.
 *
 *   Step 1 — Add an endpoint (name, type, base_url, api_key)
 *   Step 2 — Add a model pinned to that endpoint
 *
 * On Finish we persist `onboarding_completed: true`; the endpoint and
 * model writes happen incrementally as the user proceeds.
 */
export function OnboardingDialog({ open, onComplete }: Props) {
  const { t } = useTranslation();
  const { push } = useToast();
  const update = useConfig((s) => s.update);
  const addEndpoint = useConfig((s) => s.addEndpoint);
  const addModel = useConfig((s) => s.addModel);
  const removeEndpoint = useConfig((s) => s.removeEndpoint);

  const [step, setStep] = useState<Step>(1);

  // ── Step 1 state ──────────────────────────────────────────────
  const [epType, setEpType] = useState<EndpointType>("openai");
  const [epName, setEpName] = useState("OpenAI");
  const [epBaseUrl, setEpBaseUrl] = useState(DEFAULT_BASE_URL.openai);
  const [epApiKey, setEpApiKey] = useState("");
  // Tracks the URL the user has explicitly edited so we don't stomp it
  // when they switch type back and forth.
  const [urlDirty, setUrlDirty] = useState(false);
  const [nameDirty, setNameDirty] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  // Persisted across step transitions — when the user goes Back, we want
  // the same endpoint they just created, not a fresh one.
  const [endpointId, setEndpointId] = useState<string>("");

  // ── Step 2 state ──────────────────────────────────────────────
  const [modelMode, setModelMode] = useState<"preset" | "custom">("preset");
  const [presetIdx, setPresetIdx] = useState(0);
  const [customModelId, setCustomModelId] = useState("");
  const [modelLabel, setModelLabel] = useState("");
  const [labelDirty, setLabelDirty] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Reset the type-driven defaults whenever the user switches provider,
  // unless they've explicitly typed something in those fields.
  useEffect(() => {
    if (!urlDirty) setEpBaseUrl(DEFAULT_BASE_URL[epType]);
    if (!nameDirty) setEpName(ENDPOINT_TYPE_LABEL[epType]);
    setTestResult(null);
  }, [epType, urlDirty, nameDirty]);

  // Keep step-2 label in sync with selected preset / custom model name.
  const presets = PRESET_MODELS[epType];
  useEffect(() => {
    if (labelDirty) return;
    if (modelMode === "preset" && presets[presetIdx]) {
      setModelLabel(presets[presetIdx].label);
    } else if (modelMode === "custom") {
      setModelLabel(customModelId || "");
    }
  }, [modelMode, presetIdx, customModelId, labelDirty, presets]);

  // Snap presetIdx back to 0 when the type changes so we don't index past
  // the new (shorter) preset list.
  useEffect(() => {
    setPresetIdx(0);
  }, [epType]);

  const transientEndpoint = useMemo(
    () => ({
      id: "draft",
      name: epName.trim() || ENDPOINT_TYPE_LABEL[epType],
      type: epType,
      base_url: epBaseUrl.trim(),
      api_key: epApiKey.trim(),
    }),
    [epName, epType, epBaseUrl, epApiKey]
  );

  const handleTest = async () => {
    if (!epBaseUrl.trim() || !epApiKey.trim()) {
      push({ title: t("onboarding.needsBoth"), intent: "warn" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const r = await testConnection(transientEndpoint);
    setTestResult(r);
    setTesting(false);
  };

  const handleNext = async () => {
    if (!epApiKey.trim()) {
      push({ title: t("onboarding.needsBoth"), intent: "warn" });
      return;
    }
    // If user retraces back-then-forward, edit the existing endpoint
    // in place rather than creating duplicates.
    if (endpointId) {
      await useConfig.getState().updateEndpoint(endpointId, {
        name: transientEndpoint.name,
        type: transientEndpoint.type,
        base_url: transientEndpoint.base_url,
        api_key: transientEndpoint.api_key,
      });
    } else {
      const id = await addEndpoint({
        name: transientEndpoint.name,
        type: transientEndpoint.type,
        base_url: transientEndpoint.base_url,
        api_key: transientEndpoint.api_key,
      });
      setEndpointId(id);
    }
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSkip = async () => {
    // If they Started step 2 but didn't finish, clean up the half-saved
    // endpoint so we don't leave a configured-but-no-model state behind.
    if (endpointId) {
      await removeEndpoint(endpointId);
      setEndpointId("");
    }
    await update({ onboarding_completed: true });
    onComplete();
  };

  const handleFinish = async () => {
    const modelId =
      modelMode === "preset" ? presets[presetIdx]?.model_id : customModelId.trim();
    if (!modelId) {
      push({ title: t("onboarding.modelRequired"), intent: "warn" });
      return;
    }
    if (!endpointId) {
      push({ title: t("onboarding.endpointMissing"), intent: "error" });
      setStep(1);
      return;
    }
    setFinishing(true);
    await addModel({
      endpoint_id: endpointId,
      model_id: modelId,
      label: modelLabel.trim() || modelId,
      is_custom: modelMode === "custom",
    });
    await update({ onboarding_completed: true });
    setFinishing(false);
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
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[151]",
            "w-[min(600px,calc(100vw-32px))] max-h-[calc(100vh-48px)] overflow-y-auto",
            "rounded-[var(--radius)] bg-card border border-rule shadow-card-hover",
            "p-6 md:p-8",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=open]:slide-in-from-bottom-2 duration-400 ease-out"
          )}
        >
          {/* Masthead */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="amber-rule" />
              <span className="kicker">{t("onboarding.eyebrow")}</span>
            </div>
            <span className="font-mono text-[10.5px] text-trace tracking-wider">
              {t("onboarding.stepLabel", { current: step, total: 2 })}
            </span>
          </div>

          <Dialog.Title asChild>
            <h2 className="font-display font-medium leading-[0.96] tracking-[-0.025em] mb-1">
              <span className="block text-[34px] text-ink">
                {step === 1 ? t("onboarding.step1Title") : t("onboarding.step2Title")}
              </span>
              <span className="block text-[22px] text-muted">
                <span className="serif-italic font-normal">
                  {step === 1 ? t("onboarding.step1Subtitle") : t("onboarding.step2Subtitle")}
                </span>
              </span>
            </h2>
          </Dialog.Title>

          <Dialog.Description asChild>
            <p className="text-[13.5px] text-faded mt-3 mb-6 leading-relaxed">
              {step === 1 ? t("onboarding.step1Body") : t("onboarding.step2Body")}
            </p>
          </Dialog.Description>

          {step === 1 ? (
            <Step1Form
              epType={epType}
              setEpType={setEpType}
              epName={epName}
              setEpName={(v) => { setEpName(v); setNameDirty(true); }}
              epBaseUrl={epBaseUrl}
              setEpBaseUrl={(v) => { setEpBaseUrl(v); setUrlDirty(true); setTestResult(null); }}
              epApiKey={epApiKey}
              setEpApiKey={(v) => { setEpApiKey(v); setTestResult(null); }}
              testing={testing}
              testResult={testResult}
              onTest={handleTest}
              t={t}
            />
          ) : (
            <Step2Form
              endpointLabel={epName}
              endpointType={epType}
              presets={presets}
              presetIdx={presetIdx}
              setPresetIdx={(i) => { setPresetIdx(i); setLabelDirty(false); }}
              modelMode={modelMode}
              setModelMode={(m) => { setModelMode(m); setLabelDirty(false); }}
              customModelId={customModelId}
              setCustomModelId={(v) => { setCustomModelId(v); setLabelDirty(false); }}
              modelLabel={modelLabel}
              setModelLabel={(v) => { setModelLabel(v); setLabelDirty(true); }}
              t={t}
            />
          )}

          {/* Action bar */}
          <div className="mt-7 pt-5 border-t border-rule flex items-center justify-between gap-3">
            {step === 1 ? (
              <Button variant="ghost" onClick={handleSkip}>
                {t("onboarding.skip")}
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft size={13} />
                {t("onboarding.back")}
              </Button>
            )}
            {step === 1 ? (
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={testing || !epApiKey.trim()}
              >
                {t("onboarding.next")}
                <ArrowRight size={13} />
              </Button>
            ) : (
              <Button variant="primary" onClick={handleFinish} loading={finishing}>
                {t("onboarding.finish")}
                <ArrowRight size={13} />
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ─── Step 1: endpoint form ──────────────────────────────────────────── */

interface Step1Props {
  epType: EndpointType;
  setEpType: (v: EndpointType) => void;
  epName: string;
  setEpName: (v: string) => void;
  epBaseUrl: string;
  setEpBaseUrl: (v: string) => void;
  epApiKey: string;
  setEpApiKey: (v: string) => void;
  testing: boolean;
  testResult: ConnectionTestResult | null;
  onTest: () => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function Step1Form({
  epType,
  setEpType,
  epName,
  setEpName,
  epBaseUrl,
  setEpBaseUrl,
  epApiKey,
  setEpApiKey,
  testing,
  testResult,
  onTest,
  t,
}: Step1Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-3">
        <Field>
          <Label>{t("endpoint.name")}</Label>
          <Input
            value={epName}
            onChange={(e) => setEpName(e.target.value)}
            placeholder="OpenAI"
            autoFocus
          />
        </Field>
        <Field>
          <Label>{t("endpoint.type")}</Label>
          <Select value={epType} onValueChange={(v) => setEpType(v as EndpointType)}>
            <SelectItem value="openai">{t("endpoint.typeOpenai")}</SelectItem>
            <SelectItem value="google">{t("endpoint.typeGoogle")}</SelectItem>
          </Select>
        </Field>
      </div>

      <Field>
        <Label>{t("endpoint.url")}</Label>
        <Input
          value={epBaseUrl}
          onChange={(e) => setEpBaseUrl(e.target.value)}
          placeholder={DEFAULT_BASE_URL[epType]}
          mono
        />
        <Hint className="mt-1.5">{t("endpoint.urlHint")}</Hint>
      </Field>

      <Field>
        <Label>{t("endpoint.apiKey")}</Label>
        <Input
          type="password"
          value={epApiKey}
          onChange={(e) => setEpApiKey(e.target.value)}
          placeholder={epType === "openai" ? "sk-..." : "AIza..."}
          mono
        />
        <Hint className="mt-1.5">{t("endpoint.apiKeyHint")}</Hint>
      </Field>

      <div className="flex items-center gap-3 mt-1">
        <Button
          variant="outline"
          onClick={onTest}
          loading={testing}
          disabled={!epBaseUrl.trim() || !epApiKey.trim()}
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
  );
}

/* ─── Step 2: model form ─────────────────────────────────────────────── */

interface Step2Props {
  endpointLabel: string;
  endpointType: EndpointType;
  presets: { model_id: string; label: string }[];
  presetIdx: number;
  setPresetIdx: (i: number) => void;
  modelMode: "preset" | "custom";
  setModelMode: (m: "preset" | "custom") => void;
  customModelId: string;
  setCustomModelId: (v: string) => void;
  modelLabel: string;
  setModelLabel: (v: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function Step2Form({
  endpointLabel,
  endpointType,
  presets,
  presetIdx,
  setPresetIdx,
  modelMode,
  setModelMode,
  customModelId,
  setCustomModelId,
  modelLabel,
  setModelLabel,
  t,
}: Step2Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* Endpoint chip — readonly reminder */}
      <div className="flex items-center gap-2 text-[12px] text-faded">
        <span className="eyebrow">{t("model.endpoint")}</span>
        <span className="px-2 py-0.5 rounded bg-inset border border-rule text-ink font-mono text-[11.5px]">
          {endpointLabel}
        </span>
        <span className="text-trace">·</span>
        <span>{ENDPOINT_TYPE_LABEL[endpointType]}</span>
      </div>

      <Field>
        <Label>{t("model.modelId")}</Label>
        {modelMode === "preset" ? (
          <Select
            value={String(presetIdx)}
            onValueChange={(v) => setPresetIdx(Number(v))}
          >
            {presets.map((p, i) => (
              <SelectItem key={p.model_id} value={String(i)}>
                <span className="font-medium">{p.label}</span>
                <span className="text-trace ml-2 font-mono text-[11.5px]">{p.model_id}</span>
              </SelectItem>
            ))}
          </Select>
        ) : (
          <Input
            value={customModelId}
            onChange={(e) => setCustomModelId(e.target.value)}
            placeholder={t("model.customPlaceholder")}
            mono
          />
        )}
      </Field>

      <Field>
        <Label>{t("model.customToggle")}</Label>
        <div className="h-9 flex items-center gap-3">
          <Switch
            aria-label={t("model.customToggle")}
            checked={modelMode === "custom"}
            onCheckedChange={(c) => setModelMode(c ? "custom" : "preset")}
          />
          <span className="text-[12px] text-muted">
            {modelMode === "custom" ? t("model.customOn") : t("model.customOff")}
          </span>
        </div>
        <Hint className="mt-1.5">{t("model.customHint")}</Hint>
      </Field>

      <Field>
        <Label>{t("model.label")}</Label>
        <Input
          value={modelLabel}
          onChange={(e) => setModelLabel(e.target.value)}
          placeholder={t("model.labelPlaceholder")}
        />
        <Hint className="mt-1.5">{t("model.labelHint")}</Hint>
      </Field>
    </div>
  );
}
