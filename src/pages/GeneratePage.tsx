import { useCallback, useEffect, useMemo, useState } from "react";
import { useImageCache } from "@/services/cacheStore";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Page, Card } from "@/components/Page";
import { SizeSelector } from "@/components/SizeSelector";
import { ResultsView } from "@/components/ResultsView";
import { PromptHistory } from "@/components/PromptHistory";
import {
  ParamSourceHeader,
  ParamFieldsCard,
  defaultsFromConfig,
  resolveOverrides,
  type TaskOverrides,
} from "@/components/OutputOverrides";
import { useHistory } from "@/services/history";
import { Button } from "@/components/ui/Button";
import { Field, Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectItem } from "@/components/ui/Select";
import { Hint } from "@/components/ui/Hint";
import { NumberInput } from "@/components/ui/NumberInput";
import { useToast } from "@/components/ui/Toast";
import {
  ApiError,
  ImageResult,
  PartialImage,
  generate,
  generateStream,
} from "@/services/apiClient";
import { isConfigured, resolveEndpoint } from "@/services/config";
import { computeSize } from "@/services/sizeCalc";
import { ENDPOINT_TYPE_LABEL } from "@/services/presets";
import { useConfig } from "@/services/store";

interface GeneratePageProps {
  /** When supplied (e.g. from History → "Use this prompt"), pre-fills the
   *  textarea on first mount. */
  initialPrompt?: string;
  onConsumeInitialPrompt?: () => void;
}

export function GeneratePage({ initialPrompt, onConsumeInitialPrompt }: GeneratePageProps = {}) {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const updateCfg = useConfig((s) => s.update);
  const updatePreset = useConfig((s) => s.updatePreset);
  const setStatus = useConfig((s) => s.setStatus);
  const { push } = useToast();
  const addToCache = useImageCache((s) => s.add);

  const [prompt, setPrompt] = useState(initialPrompt ?? "");

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
      onConsumeInitialPrompt?.();
    }
  }, [initialPrompt, onConsumeInitialPrompt]);
  const [n, setN] = useState(1);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [partial, setPartial] = useState<PartialImage | null>(null);
  const [customOverrides, setCustomOverrides] = useState<TaskOverrides>(() => defaultsFromConfig(cfg));
  const paramSource = cfg.selected_gen_param_source || "global";
  const handleParamSourceChange = (next: string) => {
    if (next === "custom") {
      // Seed the editable form with whatever was just being used so the user
      // isn't starting from stale state.
      setCustomOverrides(resolveOverrides(cfg, paramSource, customOverrides));
    }
    void updateCfg({ selected_gen_param_source: next });
  };
  const addHistory = useHistory((s) => s.add);

  // The currently-selected model. We fall through to the first available
  // model when selected_gen_model_id is empty or stale.
  const selectedModelId = useMemo(() => {
    if (cfg.selected_gen_model_id && cfg.models.some((m) => m.id === cfg.selected_gen_model_id)) {
      return cfg.selected_gen_model_id;
    }
    return cfg.models[0]?.id ?? "";
  }, [cfg.selected_gen_model_id, cfg.models]);

  const resolved = selectedModelId ? resolveEndpoint(cfg, selectedModelId) : null;
  const isGoogle = resolved?.endpoint.type === "google";

  const handleSelectModel = (id: string) => {
    void updateCfg({ selected_gen_model_id: id });
  };

  // Effective params, derived from whichever source is active. The Dimensions
  // Card reads from here; its onChange routes the update back to the right
  // home — global → cfg, preset → that preset, custom → local state.
  const effectiveOverrides = resolveOverrides(cfg, paramSource, customOverrides);
  const handleSizeChange = (next: { aspectRatio: string; resolution: string; advanced: boolean; advancedText: string }) => {
    if (paramSource === "global") {
      void updateCfg({
        default_aspect_ratio: next.aspectRatio,
        default_resolution: next.resolution,
        advanced_size_mode: next.advanced,
        default_size: next.advancedText,
      });
    } else if (paramSource === "custom") {
      setCustomOverrides({
        ...customOverrides,
        aspect_ratio: next.aspectRatio,
        resolution: next.resolution,
        advanced_size_mode: next.advanced,
        size: next.advancedText,
      });
    } else {
      void updatePreset(paramSource, {
        aspect_ratio: next.aspectRatio,
        resolution: next.resolution,
        advanced_size_mode: next.advanced,
        size: next.advancedText,
      });
    }
  };

  const submit = useCallback(async () => {
    if (!isConfigured(cfg) || !resolved) {
      push({ title: t("dialog.missingKeyTitle"), body: t("dialog.missingKeyBody"), intent: "warn" });
      return;
    }
    const p = prompt.trim();
    if (!p) {
      push({ title: t("dialog.missingPromptTitle"), body: t("dialog.missingPromptBody"), intent: "warn" });
      return;
    }

    setBusy(true);
    setResults([]);
    setPartial(null);
    setStatus(t("status.generating"));
    addHistory(p, "generate");

    const overrides = resolveOverrides(cfg, paramSource, customOverrides);
    const size = overrides.advanced_size_mode
      ? overrides.size
      : computeSize(overrides.aspect_ratio, overrides.resolution);
    // effectiveCfg carries the OUTPUT knobs through to the client; size is
    // passed explicitly, so we don't need to back-fill default_size etc.
    const effectiveCfg = { ...cfg, ...overrides };

    try {
      const useStream = cfg.stream && n === 1;
      const imgs = useStream
        ? await generateStream(resolved.endpoint, resolved.model.model_id, effectiveCfg, p, size, n, setPartial)
        : await generate(resolved.endpoint, resolved.model.model_id, effectiveCfg, p, size, n);
      setResults(imgs);
      setPartial(null);
      setStatus(t("status.success", { count: imgs.length }));

      if (cfg.auto_cache && imgs.length > 0) {
        void addToCache({
          page: "generate",
          prompt: p,
          model: resolved.model.model_id,
          size,
          results: imgs.map((r) => r.bytes),
          outputFormat: effectiveCfg.output_format,
        });
      }
    } catch (e) {
      const title = e instanceof ApiError ? t("dialog.requestFailedTitle") : t("dialog.exceptionTitle");
      const msg = e instanceof Error ? e.message : String(e);
      push({ title, body: msg, intent: "error" });
      setStatus("");
    } finally {
      setBusy(false);
    }
  }, [cfg, resolved, prompt, n, paramSource, customOverrides, push, t, setStatus, addHistory, addToCache]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !busy) {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, busy]);

  return (
    <Page title={t("gen.title")} desc={t("gen.desc")}>
      <div className="grid gap-4 md:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)]">
        {/* Left: form */}
        <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
          <Card label={t("gen.modelSelect")}>
            {cfg.models.length === 0 ? (
              <Hint tone="warning">{t("gen.noModels")}</Hint>
            ) : (
              <Select value={selectedModelId} onValueChange={handleSelectModel}>
                {cfg.models.map((m) => {
                  const ep = cfg.endpoints.find((e) => e.id === m.endpoint_id);
                  return (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-medium">{m.label}</span>
                      {ep && (
                        <span className="text-trace ml-2 font-mono text-[11.5px]">
                          · {ep.name} ({ENDPOINT_TYPE_LABEL[ep.type]})
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </Select>
            )}
          </Card>

          <Card
            label={t("cardLabel.prompt")}
            labelTrailing={
              <div className="flex items-center gap-2">
                <PromptHistory page="generate" onPick={setPrompt} />
                <span className="font-mono text-[10.5px] text-trace tabular-nums">
                  {prompt.length}
                </span>
              </div>
            }
          >
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("gen.promptPlaceholder") ?? ""}
              rows={6}
              className="border-0 bg-transparent p-0 focus:ring-0 focus:border-0 hover:border-0 text-[14px]"
            />
          </Card>

          {!isGoogle && (
            <ParamSourceHeader
              cfg={cfg}
              source={paramSource}
              onSourceChange={handleParamSourceChange}
              customValue={customOverrides}
            />
          )}

          {!isGoogle && paramSource === "custom" && (
            <Card label={t("cardLabel.dimensions")}>
              <SizeSelector
                aspectRatio={effectiveOverrides.aspect_ratio}
                resolution={effectiveOverrides.resolution}
                advanced={effectiveOverrides.advanced_size_mode}
                advancedText={effectiveOverrides.size}
                onChange={handleSizeChange}
              />
            </Card>
          )}

          {!isGoogle && paramSource === "custom" && (
            <ParamFieldsCard
              value={customOverrides}
              onChange={setCustomOverrides}
            />
          )}

          {isGoogle && (
            <Card label={t("cardLabel.output")}>
              <Hint>{t("gen.googleHint")}</Hint>
            </Card>
          )}

          <Card label={t("cardLabel.run")}>
            <div className="flex items-end gap-4">
              {!isGoogle && (
                <Field className="w-24">
                  <Label>{t("gen.n")}</Label>
                  <NumberInput value={n} onChange={setN} min={1} max={10} />
                </Field>
              )}
              <div className="flex-1 min-w-0 pb-1">
                <span className="text-[11.5px] text-faded truncate block leading-relaxed">
                  {resolved
                    ? t("gen.modelHint", {
                        model: resolved.model.label,
                        stream: cfg.stream ? t("common.on") : t("common.off"),
                      })
                    : t("gen.noModels")}
                </span>
              </div>
            </div>
            <Button
              size="lg"
              variant="primary"
              onClick={submit}
              loading={busy}
              disabled={!resolved}
              className="w-full mt-4 group"
            >
              {!busy && <Sparkles size={15} className="transition-transform group-hover:rotate-12" />}
              {busy ? t("status.generating") : t("gen.submit")}
              {!busy && (
                <kbd className="ml-1 font-mono text-[10.5px] tracking-wider px-1.5 py-0.5 rounded bg-accent-ink/15 text-accent-ink/80">
                  Ctrl ↵
                </kbd>
              )}
            </Button>
          </Card>
        </div>

        {/* Right: results */}
        <div className="lg:sticky lg:top-2">
          <ResultsView results={results} partial={partial} streaming={busy && results.length === 0} />
        </div>
      </div>
    </Page>
  );
}
