import { useTranslation } from "react-i18next";
import { FolderOpen, FileText, ExternalLink, X } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { Page, Card } from "@/components/Page";
import { SizeSelector } from "@/components/SizeSelector";
import { Button } from "@/components/ui/Button";
import { Field, Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { NumberInput } from "@/components/ui/NumberInput";
import { AppConfig } from "@/services/config";
import { setLanguage as applyLanguage } from "@/i18n";
import { useConfig } from "@/services/store";

export function SettingsPage() {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const update = useConfig((s) => s.update);
  const configPath = useConfig((s) => s.configPath);

  const patch = (p: Partial<AppConfig>) => void update(p);

  return (
    <Page title={t("settings.title")} desc={t("settings.subtitle")}>
      <div className="max-w-[820px] w-full mx-auto flex flex-col gap-4 md:gap-5">
        <Card label={t("settings.sec.appearance")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <Label>{t("settings.theme")}</Label>
              <Select value={cfg.theme} onValueChange={(v) => patch({ theme: v as AppConfig["theme"] })}>
                <SelectItem value="system">{t("settings.themeSystem")}</SelectItem>
                <SelectItem value="light">{t("settings.themeLight")}</SelectItem>
                <SelectItem value="dark">{t("settings.themeDark")}</SelectItem>
              </Select>
            </Field>
            <Field>
              <Label>{t("settings.language")}</Label>
              <Select
                value={cfg.language}
                onValueChange={(v) => {
                  patch({ language: v as AppConfig["language"] });
                  applyLanguage(v);
                }}
              >
                <SelectItem value="system">{t("settings.langSystem")}</SelectItem>
                <SelectItem value="zh-Hans">{t("settings.langZh")}</SelectItem>
                <SelectItem value="en-US">{t("settings.langEn")}</SelectItem>
              </Select>
            </Field>
          </div>
          <p className="text-[11.5px] text-faded/90 mt-2">{t("settings.appearanceHint")}</p>
        </Card>

        <Card label={t("settings.sec.connection")}>
          <Field>
            <Label>{t("settings.baseUrl")}</Label>
            <Input
              value={cfg.base_url}
              onChange={(e) => patch({ base_url: e.target.value })}
              onBlur={(e) => patch({ base_url: e.target.value.trim() })}
              placeholder="https://api.openai.com/v1"
              mono
            />
          </Field>
          <Field className="mt-3">
            <Label>{t("settings.apiKey")}</Label>
            <Input
              type="password"
              value={cfg.api_key}
              onChange={(e) => patch({ api_key: e.target.value })}
              placeholder="sk-..."
              mono
            />
          </Field>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <Field>
              <Label>{t("settings.timeout")}</Label>
              <NumberInput
                value={cfg.timeout_seconds}
                onChange={(v) => patch({ timeout_seconds: v })}
                min={10}
                max={3600}
              />
            </Field>
            <Field>
              <Label>{t("settings.verifySsl")}</Label>
              <div className="h-9 flex items-center gap-3">
                <Switch
                  aria-label={t("settings.verifySsl")}
                  checked={cfg.verify_ssl}
                  onCheckedChange={(c) => patch({ verify_ssl: c })}
                />
                <span className="text-[12px] text-muted">
                  {cfg.verify_ssl ? t("settings.sslOn") : t("settings.sslOff")}
                </span>
              </div>
            </Field>
          </div>
          <p className="text-[11.5px] text-faded/90 mt-2">{t("settings.autoSaveHint")}</p>
        </Card>

        <Card label={t("settings.sec.models")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <Label>{t("settings.genModel")}</Label>
              <Input
                value={cfg.generation_model}
                onChange={(e) => patch({ generation_model: e.target.value })}
                onBlur={(e) => patch({ generation_model: e.target.value.trim() })}
                placeholder="gpt-image-2"
                mono
              />
            </Field>
            <Field>
              <Label>{t("settings.editModel")}</Label>
              <Input
                value={cfg.edit_model}
                onChange={(e) => patch({ edit_model: e.target.value })}
                onBlur={(e) => patch({ edit_model: e.target.value.trim() })}
                placeholder="gpt-image-2"
                mono
              />
            </Field>
          </div>
          <p className="text-[11.5px] text-faded/90 mt-2 leading-relaxed">{t("settings.availModels")}</p>

          <div className="my-4 h-px bg-rule" />

          <SizeSelector
            aspectRatio={cfg.default_aspect_ratio}
            resolution={cfg.default_resolution}
            advanced={cfg.advanced_size_mode}
            advancedText={cfg.default_size}
            onChange={(n) =>
              patch({
                default_aspect_ratio: n.aspectRatio,
                default_resolution: n.resolution,
                advanced_size_mode: n.advanced,
                default_size: n.advancedText,
              })
            }
          />
          <p className="text-[11.5px] text-faded/90 mt-2">{t("settings.sizeHint")}</p>

          <div className="my-4 h-px bg-rule" />

          <Field>
            <Label>{t("settings.responseFormat")}</Label>
            <div className="h-9 flex items-center gap-3">
              <Switch
                aria-label={t("settings.responseFormat")}
                checked={cfg.send_response_format}
                onCheckedChange={(c) => patch({ send_response_format: c })}
              />
              <span className="text-[12px] text-muted">
                {cfg.send_response_format ? t("settings.rfOn") : t("settings.rfOff")}
              </span>
            </div>
          </Field>
        </Card>

        <Card label={t("settings.sec.behavior")}>
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4">
            <Field>
              <Label>{t("settings.stream")}</Label>
              <div className="h-9 flex items-center gap-3">
                <Switch
                  aria-label={t("settings.stream")}
                  checked={cfg.stream}
                  onCheckedChange={(c) => patch({ stream: c })}
                />
                <span className="text-[12px] text-muted">
                  {cfg.stream ? t("settings.streamOn") : t("settings.streamOff")}
                </span>
              </div>
            </Field>
            <Field>
              <Label>{t("settings.partialImages")}</Label>
              <NumberInput
                value={cfg.partial_images}
                onChange={(v) => patch({ partial_images: v })}
                min={0}
                max={3}
              />
            </Field>
          </div>
          <p className="text-[11.5px] text-faded/90 mt-2">{t("settings.streamHint")}</p>

          <div className="my-4 h-px bg-rule" />

          <Field>
            <Label>{t("settings.fidelity")}</Label>
            <Select
              value={cfg.input_fidelity}
              onValueChange={(v) => patch({ input_fidelity: v as AppConfig["input_fidelity"] })}
            >
              <SelectItem value="auto">{t("settings.fidAuto")}</SelectItem>
              <SelectItem value="high">{t("settings.fidHigh")}</SelectItem>
              <SelectItem value="low">{t("settings.fidLow")}</SelectItem>
            </Select>
          </Field>
          <p className="text-[11.5px] text-faded/90 mt-2">{t("settings.fidelityHint")}</p>
        </Card>

        <Card label={t("settings.sec.saveDir")}>
          <div className="flex gap-2">
            <Input
              value={cfg.save_directory}
              readOnly
              placeholder={t("settings.saveDirPlaceholder") ?? ""}
              mono
            />
            <Button
              onClick={async () => {
                const picked = await openDialog({ directory: true });
                if (typeof picked === "string") patch({ save_directory: picked });
              }}
            >
              <FolderOpen size={12} /> {t("settings.pickDir")}
            </Button>
            <Button
              aria-label={t("a11y.clearSaveDir")}
              onClick={() => patch({ save_directory: "" })}
              variant="ghost"
            >
              <X size={12} />
            </Button>
          </div>
        </Card>

        <Card label={t("settings.sec.file")}>
          <Input value={configPath} readOnly mono />
          <div className="flex gap-2 mt-3">
            <Button
              onClick={async () => {
                try { await openPath(configPath); } catch (e) { console.error(e); }
              }}
            >
              <FileText size={12} /> {t("settings.openFile")}
            </Button>
            <Button
              onClick={async () => {
                const dir = configPath.replace(/[\\/][^\\/]+$/, "");
                try { await openPath(dir); } catch (e) { console.error(e); }
              }}
              variant="outline"
            >
              <ExternalLink size={12} /> {t("settings.revealFile")}
            </Button>
          </div>
        </Card>

        <div className="text-center py-5">
          <div className="kicker mb-2 flex justify-center items-center gap-3">
            <span className="amber-rule" />
            <span>{t("settings.about")}</span>
            <span className="amber-rule" />
          </div>
          <p className="font-display italic text-[15px] text-muted">{t("settings.aboutLine1")}</p>
          <p className="font-mono text-[10.5px] text-trace tracking-wider mt-1.5">
            {t("settings.aboutLine2")}
          </p>
        </div>
      </div>
    </Page>
  );
}
