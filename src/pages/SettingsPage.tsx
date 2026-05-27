import { ReactNode, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
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
  RefreshCw,
  Download,
  CheckCircle2,
  Plus,
  Trash2,
  AlertCircle,
  ChevronRight,
  Sliders,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { checkForUpdate, downloadAndInstall, type UpdateInfo } from "@/services/updater";

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
import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { testConnection } from "@/services/apiClient";
import { useToast } from "@/components/ui/Toast";
import { useImageCache } from "@/services/cacheStore";
import { statsOf } from "@/services/imageCache";
import { Page, Card } from "@/components/Page";
import { SizeSelector } from "@/components/SizeSelector";
import { Button } from "@/components/ui/Button";
import { Field, Label } from "@/components/ui/Label";
import { Hint } from "@/components/ui/Hint";
import { Input } from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { NumberInput } from "@/components/ui/NumberInput";
import { AppConfig, type Endpoint, type ModelEntry, type ParamPreset } from "@/services/config";
import {
  DEFAULT_BASE_URL,
  ENDPOINT_TYPE_LABEL,
  PRESET_MODELS,
  type EndpointType,
} from "@/services/presets";
import type { ConnectionTestResult } from "@/services/apiClientTypes";
import { setLanguage as applyLanguage } from "@/i18n";
import { useConfig } from "@/services/store";
import { cn } from "@/lib/utils";

type TabId = "appearance" | "connection" | "models" | "params" | "generation" | "about";

const REPO_URL = "https://github.com/EggFine/ImageManager";

export function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("appearance");

  const tabs: Array<{ id: TabId; label: string; icon: ReactNode }> = [
    { id: "appearance", label: t("settings.tab.appearance"), icon: <Palette size={14} strokeWidth={1.75} /> },
    { id: "connection", label: t("settings.tab.connection"), icon: <Plug size={14} strokeWidth={1.75} /> },
    { id: "models", label: t("settings.tab.models"), icon: <Brain size={14} strokeWidth={1.75} /> },
    { id: "params", label: t("settings.tab.params"), icon: <Sliders size={14} strokeWidth={1.75} /> },
    { id: "generation", label: t("settings.tab.generation"), icon: <Wand2 size={14} strokeWidth={1.75} /> },
    { id: "about", label: t("settings.tab.about"), icon: <Info size={14} strokeWidth={1.75} /> },
  ];

  return (
    <Page title={t("settings.title")} desc={t("settings.subtitle")}>
      {/* Tabs strip */}
      <div
        role="tablist"
        aria-label={t("settings.title")}
        className="flex items-center gap-1 border-b border-rule -mx-1 px-1 overflow-x-auto overflow-y-hidden"
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

      {/* Content — keyed by tab so React remounts on switch, re-triggering the
          fade animation each time. */}
      <div
        key={tab}
        className="flex flex-col gap-4 md:gap-5 animate-in fade-in-0 duration-200 ease-out"
      >
        {tab === "appearance" && <AppearanceTab />}
        {tab === "connection" && <ConnectionTab />}
        {tab === "models" && <ModelsTab />}
        {tab === "params" && <ParamsTab />}
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
      // The indicator is `border-b-2` IN flow, so it lives inside the button's
      // box. The strip's own `border-b` runs 1px lower; the negative `-mb-px`
      // on every tab pulls each one down so its 2px border overlays the
      // strip's 1px border seamlessly. No absolute children that bleed past
      // the box → no phantom 1-pixel overflow → no ghost main scrollbar.
      className={cn(
        "inline-flex items-center gap-2 px-3 h-10 shrink-0 -mb-px",
        "border-b-2 transition-colors duration-150",
        "text-[13px] font-medium tracking-tight",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-t-sm",
        active
          ? "border-accent text-ink"
          : "border-transparent text-faded hover:text-ink"
      )}
    >
      <span className={cn("transition-colors", active ? "text-accent" : "text-faded")}>
        {icon}
      </span>
      <span>{label}</span>
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
      <Hint className="mt-2">{t("settings.appearanceHint")}</Hint>
    </Card>
  );
}

function ConnectionTab() {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const update = useConfig((s) => s.update);
  const addEndpoint = useConfig((s) => s.addEndpoint);
  const patch = (p: Partial<AppConfig>) => void update(p);
  const [addOpen, setAddOpen] = useState(false);

  const handleCreate = async (draft: Omit<Endpoint, "id">) => {
    await addEndpoint(draft);
    setAddOpen(false);
  };

  return (
    <>
      <Card label={t("endpoint.title")}>
        {cfg.endpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <span className="text-[13px] text-faded">{t("endpoint.empty")}</span>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Plus size={13} />
              {t("endpoint.add")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cfg.endpoints.map((ep) => (
              <EndpointCard key={ep.id} endpoint={ep} />
            ))}
            <div>
              <Button variant="outline" onClick={() => setAddOpen(true)}>
                <Plus size={13} />
                {t("endpoint.add")}
              </Button>
            </div>
          </div>
        )}
        <Hint className="mt-3">{t("settings.autoSaveHint")}</Hint>
      </Card>

      <EndpointDialog open={addOpen} onOpenChange={setAddOpen} onConfirm={handleCreate} />

      <Card label={t("settings.section.behavior")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </Card>
    </>
  );
}

/** Single endpoint editor — name + type + url + key + test + delete.
 *  Lives only inside ConnectionTab. */
function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const { t } = useTranslation();
  const { push } = useToast();
  const updateEndpoint = useConfig((s) => s.updateEndpoint);
  const removeEndpoint = useConfig((s) => s.removeEndpoint);
  const modelsCount = useConfig((s) => s.config.models.filter((m) => m.endpoint_id === endpoint.id).length);
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const patchEp = (p: Partial<Endpoint>) => void updateEndpoint(endpoint.id, p);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await testConnection(endpoint);
    setTestResult(r);
    setTesting(false);
    if (r.ok) {
      push({
        title: t("settings.testOk"),
        body: r.modelCount !== undefined
          ? t("settings.testModels", { count: r.modelCount })
          : r.message,
        intent: "ok",
      });
    } else {
      push({ title: t("settings.testFail"), body: r.message, intent: "error" });
    }
  };

  const handleRemove = async () => {
    const msg = modelsCount > 0
      ? t("endpoint.removeWithModelsConfirm", { name: endpoint.name, count: modelsCount })
      : t("endpoint.removeConfirm", { name: endpoint.name });
    if (!window.confirm(msg)) return;
    await removeEndpoint(endpoint.id);
  };

  return (
    <div className="rounded-[var(--radius-sm)] border border-rule bg-paper/40">
      <CollapsibleHeader
        title={endpoint.name || ENDPOINT_TYPE_LABEL[endpoint.type]}
        subtitle={`${ENDPOINT_TYPE_LABEL[endpoint.type]} · ${endpoint.base_url || "—"}`}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onRemove={handleRemove}
        removeLabel={t("endpoint.remove")}
      />
      {expanded && (
      <div className="px-3.5 pb-3.5 pt-1">
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-3">
        <Field>
          <Label>{t("endpoint.name")}</Label>
          <Input
            value={endpoint.name}
            onChange={(e) => patchEp({ name: e.target.value })}
            onBlur={(e) => patchEp({ name: e.target.value.trim() })}
            placeholder={ENDPOINT_TYPE_LABEL[endpoint.type]}
          />
        </Field>
        <Field>
          <Label>{t("endpoint.type")}</Label>
          <Select
            value={endpoint.type}
            onValueChange={(v) => {
              const next = v as EndpointType;
              // Auto-update base_url if it's still on the previous type's default.
              const wasDefault = Object.values(DEFAULT_BASE_URL).includes(endpoint.base_url);
              patchEp({
                type: next,
                base_url: wasDefault ? DEFAULT_BASE_URL[next] : endpoint.base_url,
              });
            }}
          >
            <SelectItem value="openai">{t("endpoint.typeOpenai")}</SelectItem>
            <SelectItem value="google">{t("endpoint.typeGoogle")}</SelectItem>
          </Select>
        </Field>
      </div>

      <Field className="mt-3">
        <Label>{t("endpoint.url")}</Label>
        <Input
          value={endpoint.base_url}
          onChange={(e) => patchEp({ base_url: e.target.value })}
          onBlur={(e) => patchEp({ base_url: e.target.value.trim() })}
          placeholder={DEFAULT_BASE_URL[endpoint.type]}
          mono
        />
      </Field>

      <Field className="mt-3">
        <Label>{t("endpoint.apiKey")}</Label>
        <Input
          type="password"
          value={endpoint.api_key}
          onChange={(e) => patchEp({ api_key: e.target.value })}
          placeholder={endpoint.type === "openai" ? "sk-..." : "AIza..."}
          mono
        />
      </Field>

      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          loading={testing}
          disabled={!endpoint.api_key.trim()}
        >
          <Plug size={12} />
          {testing ? t("settings.testing") : t("settings.testConnection")}
        </Button>
        {testResult && !testing && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[12px]",
              testResult.ok ? "text-success" : "text-danger"
            )}
          >
            {testResult.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {testResult.ok
              ? testResult.modelCount !== undefined
                ? t("settings.testModels", { count: testResult.modelCount })
                : t("settings.testOk")
              : testResult.message}
          </span>
        )}
        {modelsCount > 0 && (
          <span className="ml-auto text-[11.5px] text-faded font-mono">
            {t("endpoint.modelsAttached", { count: modelsCount })}
          </span>
        )}
      </div>
      </div>
      )}
    </div>
  );
}

/** Modal form for creating a new endpoint. Mirrors the inline EndpointCard
 *  fields but the user has to commit (Create) before anything's written
 *  to config — avoids littering the list with half-typed placeholders. */
function EndpointDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (draft: Omit<Endpoint, "id">) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { push } = useToast();
  const [type, setType] = useState<EndpointType>("openai");
  const [name, setName] = useState(ENDPOINT_TYPE_LABEL.openai);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL.openai);
  const [apiKey, setApiKey] = useState("");
  const [urlDirty, setUrlDirty] = useState(false);
  const [nameDirty, setNameDirty] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [creating, setCreating] = useState(false);

  // Reset form whenever the dialog re-opens so a previous abandoned edit
  // doesn't leak into the next session.
  useEffect(() => {
    if (open) {
      setType("openai");
      setName(ENDPOINT_TYPE_LABEL.openai);
      setBaseUrl(DEFAULT_BASE_URL.openai);
      setApiKey("");
      setUrlDirty(false);
      setNameDirty(false);
      setTestResult(null);
      setTesting(false);
      setCreating(false);
    }
  }, [open]);

  // Switching provider re-fills name + URL with the new defaults unless
  // the user has explicitly typed something there.
  useEffect(() => {
    if (!urlDirty) setBaseUrl(DEFAULT_BASE_URL[type]);
    if (!nameDirty) setName(ENDPOINT_TYPE_LABEL[type]);
    setTestResult(null);
  }, [type, urlDirty, nameDirty]);

  const handleTest = async () => {
    if (!baseUrl.trim() || !apiKey.trim()) {
      push({ title: t("onboarding.needsBoth"), intent: "warn" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const r = await testConnection({
      id: "draft",
      name: name.trim() || ENDPOINT_TYPE_LABEL[type],
      type,
      base_url: baseUrl.trim(),
      api_key: apiKey.trim(),
    });
    setTestResult(r);
    setTesting(false);
  };

  const handleConfirm = async () => {
    if (!apiKey.trim()) {
      push({ title: t("onboarding.needsBoth"), intent: "warn" });
      return;
    }
    setCreating(true);
    await onConfirm({
      name: name.trim() || ENDPOINT_TYPE_LABEL[type],
      type,
      base_url: baseUrl.trim(),
      api_key: apiKey.trim(),
    });
    setCreating(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[150] bg-ink/55 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-300"
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[151]",
            "w-[min(560px,calc(100vw-32px))] max-h-[calc(100vh-48px)] overflow-y-auto",
            "rounded-[var(--radius)] bg-card border border-rule shadow-card-hover",
            "p-6 md:p-8",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=open]:slide-in-from-bottom-2 duration-300 ease-out"
          )}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="amber-rule" />
              <span className="kicker">{t("endpoint.addTitle")}</span>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={t("a11y.closeNotice")}
                className="w-7 h-7 inline-flex items-center justify-center rounded text-faded hover:bg-inset hover:text-ink transition-colors"
              >
                <X size={13} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Title asChild>
            <h2 className="font-display font-medium text-[26px] leading-[1.1] tracking-[-0.02em] mb-1 text-ink">
              {t("endpoint.addHeading")}
            </h2>
          </Dialog.Title>
          <Dialog.Description asChild>
            <p className="text-[12.5px] text-faded mt-1 mb-5 leading-relaxed">
              {t("endpoint.addBody")}
            </p>
          </Dialog.Description>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-3">
              <Field>
                <Label>{t("endpoint.name")}</Label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameDirty(true); }}
                  placeholder={ENDPOINT_TYPE_LABEL[type]}
                  autoFocus
                />
              </Field>
              <Field>
                <Label>{t("endpoint.type")}</Label>
                <Select value={type} onValueChange={(v) => setType(v as EndpointType)}>
                  <SelectItem value="openai">{t("endpoint.typeOpenai")}</SelectItem>
                  <SelectItem value="google">{t("endpoint.typeGoogle")}</SelectItem>
                </Select>
              </Field>
            </div>

            <Field>
              <Label>{t("endpoint.url")}</Label>
              <Input
                value={baseUrl}
                onChange={(e) => { setBaseUrl(e.target.value); setUrlDirty(true); setTestResult(null); }}
                placeholder={DEFAULT_BASE_URL[type]}
                mono
              />
              <Hint className="mt-1.5">{t("endpoint.urlHint")}</Hint>
            </Field>

            <Field>
              <Label>{t("endpoint.apiKey")}</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                placeholder={type === "openai" ? "sk-..." : "AIza..."}
                mono
              />
              <Hint className="mt-1.5">{t("endpoint.apiKeyHint")}</Hint>
            </Field>

            <div className="flex items-center gap-3 mt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                loading={testing}
                disabled={!baseUrl.trim() || !apiKey.trim() || creating}
              >
                <Plug size={12} />
                {testing ? t("settings.testing") : t("onboarding.test")}
              </Button>
              {testResult && !testing && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[12px]",
                    testResult.ok ? "text-success" : "text-danger"
                  )}
                >
                  {testResult.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {testResult.ok
                    ? testResult.modelCount !== undefined
                      ? t("settings.testModels", { count: testResult.modelCount })
                      : t("settings.testOk")
                    : testResult.message}
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-rule flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
              {t("endpoint.cancel")}
            </Button>
            <Button variant="primary" onClick={handleConfirm} loading={creating} disabled={!apiKey.trim()}>
              {t("endpoint.create")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ModelsTab() {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const addModel = useConfig((s) => s.addModel);

  const handleAdd = async () => {
    if (cfg.endpoints.length === 0) return;
    const endpoint = cfg.endpoints[0];
    const preset = PRESET_MODELS[endpoint.type][0];
    await addModel({
      endpoint_id: endpoint.id,
      model_id: preset.model_id,
      label: preset.label,
      is_custom: false,
    });
  };

  return (
    <Card label={t("model.title")}>
      {cfg.endpoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
          <span className="text-[13px] text-faded">{t("model.needEndpoint")}</span>
          <Hint>{t("model.needEndpointHint")}</Hint>
        </div>
      ) : cfg.models.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          <span className="text-[13px] text-faded">{t("model.empty")}</span>
          <Button variant="primary" onClick={handleAdd}>
            <Plus size={13} />
            {t("model.add")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cfg.models.map((m) => (
            <ModelCard key={m.id} model={m} />
          ))}
          <div>
            <Button variant="outline" onClick={handleAdd}>
              <Plus size={13} />
              {t("model.add")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function ParamsTab() {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const update = useConfig((s) => s.update);
  const addPreset = useConfig((s) => s.addPreset);
  const patch = (p: Partial<AppConfig>) => void update(p);
  const [subTab, setSubTab] = useState<"defaults" | "presets">("defaults");

  const handleAddPreset = async () => {
    const idx = cfg.param_presets.length + 1;
    await addPreset({
      name: t("preset.defaultName", { n: idx }),
      aspect_ratio: cfg.default_aspect_ratio,
      resolution: cfg.default_resolution,
      advanced_size_mode: cfg.advanced_size_mode,
      size: cfg.default_size,
      quality: cfg.quality,
      output_format: cfg.output_format,
      output_compression: cfg.output_compression,
      background: cfg.background,
      input_fidelity: cfg.input_fidelity,
    });
  };

  return (
    <>
      {/* Sub-tabs — segmented control */}
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-[var(--radius-sm)] bg-inset border border-rule self-start">
        <SubTabBtn active={subTab === "defaults"} onClick={() => setSubTab("defaults")}>
          {t("params.subTab.defaults")}
        </SubTabBtn>
        <SubTabBtn active={subTab === "presets"} onClick={() => setSubTab("presets")}>
          {t("params.subTab.presets")}
        </SubTabBtn>
      </div>

      {subTab === "presets" && (
        <Card label={t("preset.title")}>
          <Hint className="mb-3">{t("preset.intro")}</Hint>
          {cfg.param_presets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6">
              <span className="text-[13px] text-faded">{t("preset.empty")}</span>
              <Button variant="primary" onClick={handleAddPreset}>
                <Plus size={13} />
                {t("preset.add")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cfg.param_presets.map((p) => (
                <PresetCard key={p.id} preset={p} />
              ))}
              <div>
                <Button variant="outline" onClick={handleAddPreset}>
                  <Plus size={13} />
                  {t("preset.add")}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {subTab === "defaults" && (
        <>
        <Card label={t("settings.section.googleDefaults")}>
          <Hint className="mb-3">{t("settings.googleDefaultsHint")}</Hint>
          <Field>
            <Label>{t("settings.googleAspectRatio")}</Label>
            <Select
              value={cfg.google_aspect_ratio}
              onValueChange={(v) => patch({ google_aspect_ratio: v as AppConfig["google_aspect_ratio"] })}
            >
              <SelectItem value="1:1">1:1 — {t("size.aspect.1to1")}</SelectItem>
              <SelectItem value="4:3">4:3 — {t("size.aspect.4to3")}</SelectItem>
              <SelectItem value="3:4">3:4 — {t("size.aspect.3to4")}</SelectItem>
              <SelectItem value="16:9">16:9 — {t("size.aspect.16to9")}</SelectItem>
              <SelectItem value="9:16">9:16 — {t("size.aspect.9to16")}</SelectItem>
            </Select>
          </Field>
        </Card>

        <Card label={t("settings.section.openaiDefaults")}>
          <Hint className="mb-3">{t("settings.openaiDefaultsHint")}</Hint>

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
        <Hint className="mt-2">{t("settings.sizeHint")}</Hint>

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
        <Hint className="mt-2">{t("settings.qualityHint")}</Hint>

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
          <Hint className="mt-2">{t("settings.outputCompressionHint")}</Hint>
        )}
        {cfg.background === "transparent" && cfg.output_format === "jpeg" && (
          <Hint tone="warning" className="mt-2">{t("settings.backgroundHint")}</Hint>
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
        <Hint className="mt-2">{t("settings.fidelityHint")}</Hint>

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
        </>
      )}
    </>
  );
}

/** Sub-tab pill button — used inside ParamsTab for defaults/presets toggle. */
function SubTabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center h-7 px-3 rounded-[var(--radius-sm)] text-[12.5px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        active
          ? "bg-card text-ink shadow-card"
          : "text-faded hover:text-ink hover:bg-paper/40"
      )}
    >
      {children}
    </button>
  );
}

/** Collapsible preset card. Starts collapsed; click summary to expand. */
function PresetCard({ preset }: { preset: ParamPreset }) {
  const { t } = useTranslation();
  const updatePreset = useConfig((s) => s.updatePreset);
  const removePreset = useConfig((s) => s.removePreset);
  const [expanded, setExpanded] = useState(false);
  const patchP = (p: Partial<ParamPreset>) => void updatePreset(preset.id, p);

  const handleRemove = async () => {
    if (!window.confirm(t("preset.removeConfirm", { name: preset.name }))) return;
    await removePreset(preset.id);
  };

  return (
    <div className="rounded-[var(--radius-sm)] border border-rule bg-paper/40">
      <CollapsibleHeader
        title={preset.name}
        subtitle={`${preset.quality} · ${preset.output_format} · ${preset.background}`}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onRemove={handleRemove}
        removeLabel={t("preset.remove")}
      />
      {expanded && (
        <div className="px-3.5 pb-3.5 pt-1">
          <Field>
            <Label>{t("preset.name")}</Label>
            <Input
              value={preset.name}
              onChange={(e) => patchP({ name: e.target.value })}
              onBlur={(e) => patchP({ name: e.target.value.trim() })}
              placeholder={t("preset.namePlaceholder")}
            />
          </Field>

          <div className="mt-3">
            <SizeSelector
              aspectRatio={preset.aspect_ratio}
              resolution={preset.resolution}
              advanced={preset.advanced_size_mode}
              advancedText={preset.size}
              onChange={(n) =>
                patchP({
                  aspect_ratio: n.aspectRatio,
                  resolution: n.resolution,
                  advanced_size_mode: n.advanced,
                  size: n.advancedText,
                })
              }
            />
          </div>

          <div className="my-3 h-px bg-rule" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <Field>
              <Label>{t("settings.quality")}</Label>
              <Select
                value={preset.quality}
                onValueChange={(v) => patchP({ quality: v as ParamPreset["quality"] })}
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
                value={preset.background}
                onValueChange={(v) => patchP({ background: v as ParamPreset["background"] })}
              >
                <SelectItem value="auto">{t("settings.backgroundAuto")}</SelectItem>
                <SelectItem value="transparent">{t("settings.backgroundTransparent")}</SelectItem>
                <SelectItem value="opaque">{t("settings.backgroundOpaque")}</SelectItem>
              </Select>
            </Field>
            <Field>
              <Label>{t("settings.outputFormat")}</Label>
              <Select
                value={preset.output_format}
                onValueChange={(v) => patchP({ output_format: v as ParamPreset["output_format"] })}
              >
                <SelectItem value="auto">{t("settings.outputFormatAuto")}</SelectItem>
                <SelectItem value="png">{t("settings.outputFormatPng")}</SelectItem>
                <SelectItem value="jpeg">{t("settings.outputFormatJpeg")}</SelectItem>
                <SelectItem value="webp">{t("settings.outputFormatWebp")}</SelectItem>
              </Select>
            </Field>
            {(preset.output_format === "jpeg" || preset.output_format === "webp") && (
              <Field>
                <Label>{t("settings.outputCompression")}</Label>
                <NumberInput
                  value={preset.output_compression}
                  onChange={(v) => patchP({ output_compression: v })}
                  min={0}
                  max={100}
                />
              </Field>
            )}
            <Field>
              <Label>{t("settings.fidelity")}</Label>
              <Select
                value={preset.input_fidelity}
                onValueChange={(v) => patchP({ input_fidelity: v as ParamPreset["input_fidelity"] })}
              >
                <SelectItem value="auto">{t("settings.fidAuto")}</SelectItem>
                <SelectItem value="high">{t("settings.fidHigh")}</SelectItem>
                <SelectItem value="low">{t("settings.fidLow")}</SelectItem>
              </Select>
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shared collapsible card header — used by EndpointCard, ModelCard, PresetCard. */
function CollapsibleHeader({
  title,
  subtitle,
  expanded,
  onToggle,
  onRemove,
  removeLabel,
}: {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3.5 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 min-w-0 flex items-center gap-2 text-left rounded transition-colors hover:bg-inset/40"
        aria-expanded={expanded}
      >
        <ChevronRight
          size={14}
          className={cn(
            "shrink-0 text-faded transition-transform duration-150",
            expanded && "rotate-90"
          )}
        />
        <span className="text-[13px] font-medium text-ink truncate">{title}</span>
        {subtitle && (
          <span className="text-[11.5px] text-trace font-mono truncate ml-2">{subtitle}</span>
        )}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="w-6 h-6 inline-flex items-center justify-center rounded text-trace hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

/** Single model row: label, endpoint Select, model Select / custom Input,
 *  custom-toggle Switch, delete. */
function ModelCard({ model }: { model: ModelEntry }) {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const updateModel = useConfig((s) => s.updateModel);
  const removeModel = useConfig((s) => s.removeModel);
  const [expanded, setExpanded] = useState(false);

  const endpoint = cfg.endpoints.find((e) => e.id === model.endpoint_id);
  const endpointType: EndpointType = endpoint?.type ?? "openai";
  const presets = PRESET_MODELS[endpointType];
  const patchModel = (p: Partial<ModelEntry>) => void updateModel(model.id, p);

  const handleRemove = async () => {
    if (!window.confirm(t("model.removeConfirm", { name: model.label || model.model_id }))) return;
    await removeModel(model.id);
  };

  // Did the user switch endpoint to one whose presets no longer include this
  // model_id? Switch them into custom mode automatically so nothing's lost.
  const presetMatch = presets.find((p) => p.model_id === model.model_id);
  const effectiveCustom = model.is_custom || !presetMatch;

  return (
    <div className="rounded-[var(--radius-sm)] border border-rule bg-paper/40">
      <CollapsibleHeader
        title={model.label || model.model_id}
        subtitle={`${model.model_id}${endpoint ? ` · ${endpoint.name}` : ""}`}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onRemove={handleRemove}
        removeLabel={t("model.remove")}
      />
      {expanded && (
      <div className="px-3.5 pb-3.5 pt-1">
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-3">
        <Field>
          <Label>{t("model.label")}</Label>
          <Input
            value={model.label}
            onChange={(e) => patchModel({ label: e.target.value })}
            onBlur={(e) => patchModel({ label: e.target.value.trim() })}
            placeholder={t("model.labelPlaceholder")}
          />
        </Field>
        <Field>
          <Label>{t("model.endpoint")}</Label>
          <Select
            value={model.endpoint_id}
            onValueChange={(v) => patchModel({ endpoint_id: v })}
          >
            {cfg.endpoints.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} <span className="text-trace ml-1">({ENDPOINT_TYPE_LABEL[e.type]})</span>
              </SelectItem>
            ))}
          </Select>
        </Field>
      </div>

      <Field className="mt-3">
        <Label>{t("model.modelId")}</Label>
        {effectiveCustom ? (
          <Input
            value={model.model_id}
            onChange={(e) => patchModel({ model_id: e.target.value })}
            onBlur={(e) => patchModel({ model_id: e.target.value.trim() })}
            placeholder={t("model.customPlaceholder")}
            mono
          />
        ) : (
          <Select
            value={model.model_id}
            onValueChange={(v) => {
              const p = presets.find((x) => x.model_id === v);
              patchModel({ model_id: v, label: p?.label ?? v });
            }}
          >
            {presets.map((p) => (
              <SelectItem key={p.model_id} value={p.model_id}>
                <span className="font-medium">{p.label}</span>
                <span className="text-trace ml-2 font-mono text-[11.5px]">{p.model_id}</span>
              </SelectItem>
            ))}
          </Select>
        )}
      </Field>

      <Field className="mt-3">
        <Label>{t("model.customToggle")}</Label>
        <div className="h-9 flex items-center gap-3">
          <Switch
            aria-label={t("model.customToggle")}
            checked={effectiveCustom}
            onCheckedChange={(c) => patchModel({ is_custom: c })}
          />
          <span className="text-[12px] text-muted">
            {effectiveCustom ? t("model.customOn") : t("model.customOff")}
          </span>
        </div>
      </Field>
      </div>
      )}
    </div>
  );
}

function GenerationTab() {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const update = useConfig((s) => s.update);
  const configPath = useConfig((s) => s.configPath);
  const patch = (p: Partial<AppConfig>) => void update(p);
  const { push } = useToast();

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
        <Hint className="mt-2">{t("settings.streamHint")}</Hint>

        <div className="my-4 h-px bg-rule" />

        <CacheControls />
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
                push({ title: String(e), intent: "error" });
              }
            }}
          >
            <FileText size={12} /> {t("settings.openFile")}
          </Button>
          <Button
            onClick={async () => {
              try {
                await revealItemInDir(configPath);
              } catch (e) {
                console.error(e);
                push({ title: String(e), intent: "error" });
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

function CacheControls() {
  const { t } = useTranslation();
  const cfg = useConfig((s) => s.config);
  const update = useConfig((s) => s.update);
  const patch = (p: Partial<AppConfig>) => void update(p);
  const entries = useImageCache((s) => s.entries);
  const clearCache = useImageCache((s) => s.clear);
  const stats = statsOf(entries);

  const onClear = async () => {
    if (!window.confirm(t("historyPage.confirmClear"))) return;
    await clearCache();
  };

  return (
    <Field>
      <Label>{t("settings.autoCache")}</Label>
      <div className="h-9 flex items-center gap-3">
        <Switch
          aria-label={t("settings.autoCache")}
          checked={cfg.auto_cache}
          onCheckedChange={(c) => patch({ auto_cache: c })}
        />
        <span className="text-[12px] text-muted">
          {cfg.auto_cache ? t("settings.autoCacheOn") : t("settings.autoCacheOff")}
        </span>
      </div>
      <Hint className="mt-2">{t("settings.autoCacheHint")}</Hint>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11.5px] text-faded font-mono tracking-tight">
          {t("settings.cacheStats", { entries: stats.entryCount, images: stats.imageCount })}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          disabled={stats.entryCount === 0}
        >
          {t("settings.clearCache")}
        </Button>
      </div>
    </Field>
  );
}

function AboutTab() {
  const { t } = useTranslation();
  const { push } = useToast();
  const [version, setVersion] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);

  // Pull the running app's version from Tauri at mount. This reads from
  // tauri.conf.json's `"version": "../package.json"` pointer, so it's the
  // single source of truth — no hardcoding, no drift after `package.json`
  // bumps.
  useEffect(() => {
    void getVersion()
      .then(setVersion)
      .catch((e) => console.error("getVersion failed", e));
  }, []);

  const openLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    setUpdateInfo(null);
    try {
      const info = await checkForUpdate();
      if (info) {
        setUpdateInfo(info);
        push({
          title: t("updater.available", { version: info.version }),
          body: t("updater.availableBody"),
          intent: "info",
        });
      } else {
        push({
          title: t("updater.upToDate"),
          body: `v${version}`,
          intent: "ok",
        });
      }
    } catch (e) {
      push({
        title: t("updater.failed"),
        body: e instanceof Error ? e.message : String(e),
        intent: "error",
      });
    }
    setChecking(false);
  };

  const handleInstall = async () => {
    if (!updateInfo) return;
    setInstalling(true);
    try {
      await downloadAndInstall(updateInfo);
      // App will relaunch on success — no further UI needed.
    } catch (e) {
      push({
        title: t("updater.failed"),
        body: e instanceof Error ? e.message : String(e),
        intent: "error",
      });
      setInstalling(false);
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
            {t("about.versionLabel")}{" "}
            <span className="text-faded">{version ? `v${version}` : "…"}</span>
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
            <Button
              variant="outline"
              onClick={handleCheck}
              loading={checking}
              disabled={installing}
            >
              <RefreshCw size={13} />
              {checking ? t("updater.checking") : t("updater.checkForUpdates")}
            </Button>
          </div>

          {/* Update-found callout — only rendered when an update is sitting
              available. Lets the user pull the trigger without leaving the
              About tab. */}
          {updateInfo && (
            <div className="rounded-[var(--radius)] border border-accent/30 bg-accent-soft/40 p-3.5 flex items-start gap-3">
              <CheckCircle2 size={16} className="text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-ink font-medium">
                  {t("updater.available", { version: updateInfo.version })}
                </div>
                {updateInfo.body && (
                  <div className="text-[12px] text-faded mt-1 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                    {updateInfo.body}
                  </div>
                )}
                <div className="text-[10.5px] text-trace mt-1.5 font-mono">
                  v{version} → v{updateInfo.version}
                </div>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={handleInstall}
                loading={installing}
              >
                <Download size={12} />
                {installing ? t("updater.installing") : t("updater.installAndRestart")}
              </Button>
            </div>
          )}

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
