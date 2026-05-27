import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FolderOpen,
  FileText,
  ExternalLink,
  X,
  Palette,
  Plug,
  Brain,
  Wand2,
  Info,
  Bug,
  PackageOpen,
  ArrowRight,
  Star,
} from "lucide-react";

/** Inline GitHub octocat — `Github` was removed from lucide-react. */
function GithubIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { testConnection } from "@/services/apiClient";
import { useToast } from "@/components/ui/Toast";
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
import { cn } from "@/lib/utils";

type TabId = "appearance" | "connection" | "models" | "generation" | "about";

const REPO_URL = "https://github.com/EggFine/ImageManager";

export function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("appearance");

  const tabs: Array<{ id: TabId; label: string; icon: ReactNode }> = [
    { id: "appearance", label: t("settings.tab.appearance"), icon: <Palette size={14} strokeWidth={1.75} /> },
    { id: "connection", label: t("settings.tab.connection"), icon: <Plug size={14} strokeWidth={1.75} /> },
    { id: "models", label: t("settings.tab.models"), icon: <Brain size={14} strokeWidth={1.75} /> },
    { id: "generation", label: t("settings.tab.generation"), icon: <Wand2 size={14} strokeWidth={1.75} /> },
    { id: "about", label: t("settings.tab.about"), icon: <Info size={14} strokeWidth={1.75} /> },
  ];

  return (
    <Page title={t("settings.title")} desc={t("settings.subtitle")}>
      {/* Tabs strip */}
      <div
        role="tablist"
        aria-label={t("settings.title")}
        className="flex items-center gap-1 border-b border-rule/70 -mx-1 px-1 overflow-x-auto"
      >
        {tabs.map((tspec) => (
          <TabBtn
            key={tspec.id}
            active={tab === tspec.id}
            icon={tspec.icon}
            label={tspec.label}
            onClick={() => setTab(tspec.id)}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 md:gap-5">
        {tab === "appearance" && <AppearanceTab />}
        {tab === "connection" && <ConnectionTab />}
        {tab === "models" && <ModelsTab />}
        {tab === "generation" && <GenerationTab />}
        {tab === "about" && <AboutTab />}
      </div>
    </Page>
  );
}

/* ─── Tab button ──────────────────────────────────────────────────────── */

function TabBtn({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-2 px-3 py-2.5 shrink-0",
        "text-[13px] font-medium tracking-tight transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-t-sm",
        active ? "text-ink" : "text-faded hover:text-ink"
      )}
    >
      <span className={cn("transition-colors", active ? "text-accent" : "text-faded")}>
        {icon}
      </span>
      <span>{label}</span>
      <span
        className={cn(
          "absolute left-2 right-2 -bottom-px h-[2px] bg-accent rounded-full",
          "transition-opacity duration-150",
          active ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
      />
    </button>
  );
}

/* ─── Tabs ────────────────────────────────────────────────────────────── */

function AppearanceTab() {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const update = useConfig((s) => s.update);
  const patch = (p: Partial<AppConfig>) => void update(p);

  return (
    <Card>
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
  );
}

function ConnectionTab() {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const update = useConfig((s) => s.update);
  const patch = (p: Partial<AppConfig>) => void update(p);
  const { push } = useToast();
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    const r = await testConnection(cfg);
    setTesting(false);
    if (r.ok) {
      const body = r.modelCount !== undefined
        ? t("settings.testModels", { count: r.modelCount })
        : r.message;
      push({ title: t("settings.testOk"), body, intent: "ok" });
    } else {
      push({ title: t("settings.testFail"), body: r.message, intent: "error" });
    }
  };

  return (
    <Card>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
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

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-faded/90">{t("settings.autoSaveHint")}</p>
        <Button
          variant="outline"
          onClick={handleTest}
          loading={testing}
          disabled={!cfg.api_key.trim()}
        >
          <Plug size={13} />
          {testing ? t("settings.testing") : t("settings.testConnection")}
        </Button>
      </div>
    </Card>
  );
}

function ModelsTab() {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const update = useConfig((s) => s.update);
  const patch = (p: Partial<AppConfig>) => void update(p);

  return (
    <Card>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field>
          <Label>{t("settings.quality")}</Label>
          <Select
            value={cfg.quality}
            onValueChange={(v) => patch({ quality: v as AppConfig["quality"] })}
          >
            <SelectItem value="auto">{t("settings.qualityAuto")}</SelectItem>
            <SelectItem value="low">{t("settings.qualityLow")}</SelectItem>
            <SelectItem value="medium">{t("settings.qualityMedium")}</SelectItem>
            <SelectItem value="high">{t("settings.qualityHigh")}</SelectItem>
          </Select>
        </Field>
        <Field>
          <Label>{t("settings.background")}</Label>
          <Select
            value={cfg.background}
            onValueChange={(v) => patch({ background: v as AppConfig["background"] })}
          >
            <SelectItem value="auto">{t("settings.backgroundAuto")}</SelectItem>
            <SelectItem value="transparent">{t("settings.backgroundTransparent")}</SelectItem>
            <SelectItem value="opaque">{t("settings.backgroundOpaque")}</SelectItem>
          </Select>
        </Field>
      </div>
      <p className="text-[11.5px] text-faded/90 mt-2">{t("settings.qualityHint")}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        <Field>
          <Label>{t("settings.outputFormat")}</Label>
          <Select
            value={cfg.output_format}
            onValueChange={(v) => patch({ output_format: v as AppConfig["output_format"] })}
          >
            <SelectItem value="auto">{t("settings.outputFormatAuto")}</SelectItem>
            <SelectItem value="png">{t("settings.outputFormatPng")}</SelectItem>
            <SelectItem value="jpeg">{t("settings.outputFormatJpeg")}</SelectItem>
            <SelectItem value="webp">{t("settings.outputFormatWebp")}</SelectItem>
          </Select>
        </Field>
        {(cfg.output_format === "jpeg" || cfg.output_format === "webp") && (
          <Field>
            <Label>{t("settings.outputCompression")}</Label>
            <NumberInput
              value={cfg.output_compression}
              onChange={(v) => patch({ output_compression: v })}
              min={0}
              max={100}
            />
          </Field>
        )}
      </div>
      {(cfg.output_format === "jpeg" || cfg.output_format === "webp") && (
        <p className="text-[11.5px] text-faded/90 mt-2">{t("settings.outputCompressionHint")}</p>
      )}
      {cfg.background === "transparent" && cfg.output_format === "jpeg" && (
        <p className="text-[11.5px] text-warning mt-2">{t("settings.backgroundHint")}</p>
      )}

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
  );
}

function GenerationTab() {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const update = useConfig((s) => s.update);
  const configPath = useConfig((s) => s.configPath);
  const patch = (p: Partial<AppConfig>) => void update(p);

  return (
    <>
      <Card label={t("settings.section.behavior")}>
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
      </Card>

      <Card label={t("settings.section.storage")}>
        <Field>
          <Label>{t("settings.sec.saveDir")}</Label>
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
        </Field>

        <div className="my-4 h-px bg-rule" />

        <Field>
          <Label>{t("settings.sec.file")}</Label>
          <Input value={configPath} readOnly mono />
        </Field>
        <div className="flex gap-2 mt-3">
          <Button
            onClick={async () => {
              try {
                await openPath(configPath);
              } catch (e) {
                console.error(e);
              }
            }}
          >
            <FileText size={12} /> {t("settings.openFile")}
          </Button>
          <Button
            onClick={async () => {
              const dir = configPath.replace(/[\\/][^\\/]+$/, "");
              try {
                await openPath(dir);
              } catch (e) {
                console.error(e);
              }
            }}
            variant="outline"
          >
            <ExternalLink size={12} /> {t("settings.revealFile")}
          </Button>
        </div>
      </Card>
    </>
  );
}

function AboutTab() {
  const { t } = useTranslation();

  const openLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Card>
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Left: identity */}
        <div className="md:w-[280px] shrink-0 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            <span className="font-mono text-[11.5px] tracking-[0.16em] uppercase text-faded">
              ImageManager
            </span>
          </div>
          <h2 className="font-display text-[28px] font-medium tracking-[-0.02em] leading-[1.05] text-ink">
            Hi<span className="text-accent">.</span>
            <br />
            <span className="serif-italic font-normal text-muted">I&rsquo;m </span>
            <span className="text-ink">ImageManager</span>
            <span className="text-accent">.</span>
          </h2>
          <div className="font-mono text-[10.5px] tracking-[0.18em] text-trace mt-1">
            {t("about.versionLabel")} <span className="text-faded">0.1.0</span>
          </div>
        </div>

        {/* Right: details */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <p className="text-[13.5px] text-faded leading-relaxed">{t("about.description")}</p>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => openLink(REPO_URL)}>
              <GithubIcon size={13} />
              {t("about.viewOnGithub")}
              <ArrowRight size={12} className="opacity-60" />
            </Button>
            <Button variant="outline" onClick={() => openLink(`${REPO_URL}/stargazers`)}>
              <Star size={13} />
              {t("about.starOnGithub")}
            </Button>
            <Button variant="outline" onClick={() => openLink(`${REPO_URL}/issues/new`)}>
              <Bug size={13} />
              {t("about.reportIssue")}
            </Button>
            <Button variant="ghost" onClick={() => openLink(`${REPO_URL}/releases`)}>
              <PackageOpen size={13} />
              {t("about.viewReleases")}
            </Button>
          </div>

          <div className="h-px bg-rule" />

          {/* Meta grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
            <MetaRow label={t("about.techStack")}>
              <span className="font-mono text-[12px] text-ink leading-relaxed">
                Tauri 2 · React 19
                <br />
                TypeScript · Tailwind v4
              </span>
            </MetaRow>
            <MetaRow label={t("about.license")}>
              <span className="font-mono text-[12px] text-ink">{t("about.licenseValue")}</span>
            </MetaRow>
            <MetaRow label={t("about.credits")}>
              <span className="font-mono text-[12px] text-ink leading-relaxed">
                {t("about.creditsValue")}
              </span>
            </MetaRow>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow text-trace">{label}</span>
      {children}
    </div>
  );
}
