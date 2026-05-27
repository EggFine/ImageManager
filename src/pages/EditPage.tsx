import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Wand2, X } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import { Page, Card } from "@/components/Page";
import { SizeSelector } from "@/components/SizeSelector";
import { ResultsView } from "@/components/ResultsView";
import { Button } from "@/components/ui/Button";
import { Field, Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { NumberInput } from "@/components/ui/NumberInput";
import { useToast } from "@/components/ui/Toast";
import { ApiError, ImageResult, PartialImage, edit, editStream } from "@/services/apiClient";
import { computeSize } from "@/services/sizeCalc";
import { isConfigured } from "@/services/config";
import { useConfig } from "@/services/store";

export function EditPage() {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const updateCfg = useConfig((s) => s.update);
  const setStatus = useConfig((s) => s.setStatus);
  const { push } = useToast();

  const [imagePath, setImagePath] = useState("");
  const [maskPath, setMaskPath] = useState("");
  const [prompt, setPrompt] = useState("");
  const [n, setN] = useState(1);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [partial, setPartial] = useState<PartialImage | null>(null);

  const pickPng = async (): Promise<string | null> => {
    const picked = await openDialog({ filters: [{ name: "PNG", extensions: ["png"] }] });
    if (typeof picked === "string") return picked;
    if (picked && typeof picked === "object" && "path" in picked)
      return (picked as { path: string }).path;
    return null;
  };

  const submit = useCallback(async () => {
    if (!isConfigured(cfg)) {
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
    const size = cfg.advanced_size_mode
      ? cfg.default_size
      : computeSize(cfg.default_aspect_ratio, cfg.default_resolution);
    const mask = maskPath || null;

    setBusy(true);
    setResults([]);
    setPartial(null);
    setStatus(t("status.processing"));

    try {
      const useStream = cfg.stream && n === 1;
      const imgs = useStream
        ? await editStream(cfg, imagePath, mask, p, size, n, setPartial)
        : await edit(cfg, imagePath, mask, p, size, n);
      setResults(imgs);
      setPartial(null);
      setStatus(t("status.success", { count: imgs.length }));
    } catch (e) {
      const title = e instanceof ApiError ? t("dialog.requestFailedTitle") : t("dialog.exceptionTitle");
      const msg = e instanceof Error ? e.message : String(e);
      push({ title, body: msg, intent: "error" });
      setStatus("");
    } finally {
      setBusy(false);
    }
  }, [cfg, imagePath, maskPath, prompt, n, push, t, setStatus]);

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

  const isImg2 = cfg.edit_model.toLowerCase().startsWith("gpt-image-2");
  const fidelity = isImg2 ? t("edit.fidelityImg2") : t("edit.fidelityCustom", { value: cfg.input_fidelity });

  return (
    <Page title={t("edit.title")} desc={t("edit.desc")}>
      <div className="grid gap-4 md:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)]">
        <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
          <Card label={t("cardLabel.inputs")}>
            <Field className="mb-3">
              <Label>{t("edit.source")}</Label>
              <div className="flex gap-2">
                <Input value={imagePath} readOnly placeholder={t("common.notSelected") ?? ""} mono />
                <Button
                  aria-label={t("a11y.pickImage")}
                  onClick={async () => { const p = await pickPng(); if (p) setImagePath(p); }}
                >
                  <FolderOpen size={12} />
                </Button>
              </div>
            </Field>
            <Field>
              <Label>{t("edit.mask")}</Label>
              <div className="flex gap-2">
                <Input value={maskPath} readOnly placeholder={t("common.notSelected") ?? ""} mono />
                <Button
                  aria-label={t("a11y.pickImage")}
                  onClick={async () => { const p = await pickPng(); if (p) setMaskPath(p); }}
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
          </Card>

          <Card
            label={t("cardLabel.prompt")}
            labelTrailing={
              <span className="font-mono text-[10.5px] text-trace tabular-nums">
                {prompt.length}
              </span>
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

          <Card label={t("cardLabel.dimensions")}>
            <SizeSelector
              aspectRatio={cfg.default_aspect_ratio}
              resolution={cfg.default_resolution}
              advanced={cfg.advanced_size_mode}
              advancedText={cfg.default_size}
              onChange={(n) =>
                updateCfg({
                  default_aspect_ratio: n.aspectRatio,
                  default_resolution: n.resolution,
                  advanced_size_mode: n.advanced,
                  default_size: n.advancedText,
                })
              }
            />
          </Card>

          <Card label={t("cardLabel.run")}>
            <div className="flex items-end gap-4">
              <Field className="w-24">
                <Label>{t("gen.n")}</Label>
                <NumberInput value={n} onChange={setN} min={1} max={10} />
              </Field>
              <div className="flex-1 min-w-0 pb-1">
                <span className="text-[11.5px] text-faded truncate block leading-relaxed">
                  {t("edit.modelHint", { model: cfg.edit_model, fidelity, stream: cfg.stream ? t("common.on") : t("common.off") })}
                </span>
              </div>
            </div>
            <Button
              size="lg"
              variant="primary"
              onClick={submit}
              loading={busy}
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
