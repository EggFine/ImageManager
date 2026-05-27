import { useCallback, useEffect, useMemo, useState } from "react";
import { useImageCache } from "@/services/cacheStore";
import { useTranslation } from "react-i18next";
import { FolderOpen, Wand2, X, ImageDown } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
import { Button } from "@/components/ui/Button";
import { Field, Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select, SelectItem } from "@/components/ui/Select";
import { Hint } from "@/components/ui/Hint";
import { useToast } from "@/components/ui/Toast";
import { ApiError, ImageResult, PartialImage, edit, editStream } from "@/services/apiClient";
import { computeSize } from "@/services/sizeCalc";
import { isConfigured, resolveEndpoint } from "@/services/config";
import { useConfig } from "@/services/store";
import { useHistory } from "@/services/history";
import { ENDPOINT_TYPE_LABEL } from "@/services/presets";
import { cn } from "@/lib/utils";

const SUPPORTED_EXT = /\.(png|jpe?g|webp)$/i;

interface EditPageProps {
  initialPrompt?: string;
  onConsumeInitialPrompt?: () => void;
}

export function EditPage({ initialPrompt, onConsumeInitialPrompt }: EditPageProps = {}) {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const updateCfg = useConfig((s) => s.update);
  const updatePreset = useConfig((s) => s.updatePreset);
  const setStatus = useConfig((s) => s.setStatus);
  const { push } = useToast();
  const addToCache = useImageCache((s) => s.add);

  const [imagePath, setImagePath] = useState("");
  const [maskPath, setMaskPath] = useState("");
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
  const [dragHover, setDragHover] = useState(false);
  const [customOverrides, setCustomOverrides] = useState<TaskOverrides>(() => defaultsFromConfig(cfg));
  const paramSource = cfg.selected_edit_param_source || "global";
  const handleParamSourceChange = (next: string) => {
    if (next === "custom") {
      setCustomOverrides(resolveOverrides(cfg, paramSource, customOverrides));
    }
    void updateCfg({ selected_edit_param_source: next });
  };
  const addHistory = useHistory((s) => s.add);

  const selectedModelId = useMemo(() => {
    if (cfg.selected_edit_model_id && cfg.models.some((m) => m.id === cfg.selected_edit_model_id)) {
      return cfg.selected_edit_model_id;
    }
    return cfg.models[0]?.id ?? "";
  }, [cfg.selected_edit_model_id, cfg.models]);

  const resolved = selectedModelId ? resolveEndpoint(cfg, selectedModelId) : null;
  const isGoogle = resolved?.endpoint.type === "google";

  const handleSelectModel = (id: string) => {
    void updateCfg({ selected_edit_model_id: id });
  };

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

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      unlisten = await getCurrentWindow().onDragDropEvent((event) => {
        const payload = event.payload as
          | { type: "enter" | "over"; paths?: string[] }
          | { type: "drop"; paths: string[] }
          | { type: "leave" };
        if (payload.type === "enter" || payload.type === "over") setDragHover(true);
        else if (payload.type === "leave") setDragHover(false);
        else if (payload.type === "drop") {
          setDragHover(false);
          const path = payload.paths?.find((p) => SUPPORTED_EXT.test(p));
          if (path) setImagePath(path);
          else if (payload.paths?.length) {
            push({
              title: t("dialog.invalidImageTitle"),
              body: t("dnd.invalidFormat"),
              intent: "warn",
            });
          }
        }
      });
    };
    void setup();
    return () => { unlisten?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickFile = async (filters: { name: string; extensions: string[] }[]): Promise<string | null> => {
    const picked = await openDialog({ filters });
    if (typeof picked === "string") return picked;
    if (picked && typeof picked === "object" && "path" in picked)
      return (picked as { path: string }).path;
    return null;
  };
  const pickSource = () =>
    pickFile([{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] }]);
  const pickMask = () => pickFile([{ name: "PNG", extensions: ["png"] }]);

  const submit = useCallback(async () => {
    if (!isConfigured(cfg) || !resolved) {
      push({ title: t("dialog.missingKeyTitle"), body: t("dialog.missingKeyBody"), intent: "warn" });
      return;
    }
    if (!imagePath || !(await exists(imagePath))) {
      push({ title: t("dialog.invalidImageTitle"), body: t("dialog.invalidImageBody"), intent: "warn" });
      return;
    }
    const p = prompt.trim();
    if (!p) {
      push({ title: t("dialog.missingPromptTitle"), body: t("dialog.missingEditPromptBody"), intent: "warn" });
      return;
    }
    // Gemini doesn't support a separate mask channel — silently drop.
    const mask = isGoogle ? null : maskPath || null;

    setBusy(true);
    setResults([]);
    setPartial(null);
    setStatus(t("status.processing"));
    addHistory(p, "edit");

    const overrides = resolveOverrides(cfg, paramSource, customOverrides);
    const size = overrides.advanced_size_mode
      ? overrides.size
      : computeSize(overrides.aspect_ratio, overrides.resolution);
    const effectiveCfg = { ...cfg, ...overrides };

    try {
      const useStream = cfg.stream && n === 1;
      const imgs = useStream
        ? await editStream(resolved.endpoint, resolved.model.model_id, effectiveCfg, imagePath, mask, p, size, n, setPartial)
        : await edit(resolved.endpoint, resolved.model.model_id, effectiveCfg, imagePath, mask, p, size, n);
      setResults(imgs);
      setPartial(null);
      setStatus(t("status.success", { count: imgs.length }));

      if (cfg.auto_cache && imgs.length > 0) {
        void addToCache({
          page: "edit",
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
  }, [cfg, resolved, imagePath, maskPath, prompt, n, paramSource, customOverrides, isGoogle, push, t, setStatus, addHistory, addToCache]);

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

  const isImg2 = !!resolved && resolved.model.model_id.toLowerCase().startsWith("gpt-image-2");
  const fidelity = isImg2 ? t("edit.fidelityImg2") : t("edit.fidelityCustom", { value: cfg.input_fidelity });

  return (
    <Page title={t("edit.title")} desc={t("edit.desc")}>
      <div className="relative grid gap-4 md:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)]">
        {dragHover && (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-10 rounded-[var(--radius)]",
              "flex items-center justify-center",
              "bg-accent-soft/40 backdrop-blur-[2px]",
              "border-2 border-dashed border-accent animate-in fade-in-0 duration-150"
            )}
            aria-hidden
          >
            <div className="flex flex-col items-center gap-2 text-accent">
              <ImageDown size={32} strokeWidth={1.5} />
              <span className="font-display italic text-[16px]">{t("dnd.dropToReplaceSource")}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
          <Card label={t("edit.modelSelect")}>
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

          <Card label={t("cardLabel.inputs")}>
            <Field className="mb-3">
              <Label>{t("edit.source")}</Label>
              <div className="flex gap-2">
                <Input value={imagePath} readOnly placeholder={t("common.notSelected") ?? ""} mono />
                <Button
                  aria-label={t("a11y.pickImage")}
                  onClick={async () => { const p = await pickSource(); if (p) setImagePath(p); }}
                >
                  <FolderOpen size={12} />
                </Button>
              </div>
            </Field>
            {!isGoogle && (
              <Field>
                <Label>{t("edit.mask")}</Label>
                <div className="flex gap-2">
                  <Input value={maskPath} readOnly placeholder={t("common.notSelected") ?? ""} mono />
                  <Button
                    aria-label={t("a11y.pickImage")}
                    onClick={async () => { const p = await pickMask(); if (p) setMaskPath(p); }}
                  >
                    <FolderOpen size={12} />
                  </Button>
                  <Button
                    aria-label={t("a11y.clearMask")}
                    onClick={() => setMaskPath("")}
                    variant="ghost"
                  >
                    <X size={12} />
                  </Button>
                </div>
              </Field>
            )}
            {isGoogle && <Hint>{t("edit.googleMaskHint")}</Hint>}
          </Card>

          <Card
            label={t("cardLabel.prompt")}
            labelTrailing={
              <div className="flex items-center gap-2">
                <PromptHistory page="edit" onPick={setPrompt} />
                <span className="font-mono text-[10.5px] text-trace tabular-nums">
                  {prompt.length}
                </span>
              </div>
            }
          >
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("edit.promptPlaceholder") ?? ""}
              rows={4}
              className="border-0 bg-transparent p-0 focus:ring-0 focus:border-0 hover:border-0 text-[14px]"
            />
          </Card>

          {!isGoogle && (
            <ParamSourceHeader
              cfg={cfg}
              source={paramSource}
              onSourceChange={handleParamSourceChange}
              customValue={customOverrides}
              showFidelity
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
              showFidelity
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
                    ? t("edit.modelHint", { model: resolved.model.label, fidelity, stream: cfg.stream ? t("common.on") : t("common.off") })
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
              {!busy && <Wand2 size={15} className="transition-transform group-hover:-rotate-12" />}
              {busy ? t("status.processing") : t("edit.submit")}
              {!busy && (
                <kbd className="ml-1 font-mono text-[10.5px] tracking-wider px-1.5 py-0.5 rounded bg-accent-ink/15 text-accent-ink/80">
                  Ctrl ↵
                </kbd>
              )}
            </Button>
          </Card>
        </div>

        <div className="lg:sticky lg:top-2">
          <ResultsView results={results} partial={partial} streaming={busy && results.length === 0} />
        </div>
      </div>
    </Page>
  );
}
