import { create } from "zustand";
import {
  AppConfig,
  Endpoint,
  ModelEntry,
  ParamPreset,
  defaultConfig,
  getConfigPath,
  loadConfig,
  newId,
  saveConfig,
} from "./config";

interface ConfigStore {
  config: AppConfig;
  ready: boolean;
  configPath: string;
  status: string;

  init: () => Promise<void>;
  update: (patch: Partial<AppConfig>) => Promise<void>;
  setStatus: (text: string) => void;

  addEndpoint: (partial: Omit<Endpoint, "id">) => Promise<string>;
  updateEndpoint: (id: string, patch: Partial<Omit<Endpoint, "id">>) => Promise<void>;
  removeEndpoint: (id: string) => Promise<void>;

  addModel: (partial: Omit<ModelEntry, "id">) => Promise<string>;
  updateModel: (id: string, patch: Partial<Omit<ModelEntry, "id">>) => Promise<void>;
  removeModel: (id: string) => Promise<void>;

  addPreset: (partial: Omit<ParamPreset, "id">) => Promise<string>;
  updatePreset: (id: string, patch: Partial<Omit<ParamPreset, "id">>) => Promise<void>;
  removePreset: (id: string) => Promise<void>;
}

export const useConfig = create<ConfigStore>((set, get) => {
  const writeConfig = async (next: AppConfig) => {
    set({ config: next });
    await saveConfig(next);
  };

  return {
    config: defaultConfig,
    ready: false,
    configPath: "",
    status: "",

    init: async () => {
      const path = await getConfigPath();
      const cfg = await loadConfig();
      set({ config: cfg, ready: true, configPath: path });
    },

    update: async (patch) => {
      const next = { ...get().config, ...patch };
      await writeConfig(next);
    },

    setStatus: (text) => set({ status: text }),

    addEndpoint: async (partial) => {
      const id = newId();
      const cfg = get().config;
      const next: AppConfig = {
        ...cfg,
        endpoints: [...cfg.endpoints, { ...partial, id }],
      };
      await writeConfig(next);
      return id;
    },

    updateEndpoint: async (id, patch) => {
      const cfg = get().config;
      const next: AppConfig = {
        ...cfg,
        endpoints: cfg.endpoints.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      };
      await writeConfig(next);
    },

    removeEndpoint: async (id) => {
      const cfg = get().config;
      // Cascade: drop models pinned to this endpoint, then clear any
      // selected_*_model_id that pointed into the now-removed set.
      const survivingModels = cfg.models.filter((m) => m.endpoint_id !== id);
      const removedModelIds = new Set(
        cfg.models.filter((m) => m.endpoint_id === id).map((m) => m.id)
      );
      const next: AppConfig = {
        ...cfg,
        endpoints: cfg.endpoints.filter((e) => e.id !== id),
        models: survivingModels,
        selected_gen_model_id: removedModelIds.has(cfg.selected_gen_model_id)
          ? ""
          : cfg.selected_gen_model_id,
        selected_edit_model_id: removedModelIds.has(cfg.selected_edit_model_id)
          ? ""
          : cfg.selected_edit_model_id,
      };
      await writeConfig(next);
    },

    addModel: async (partial) => {
      const id = newId();
      const cfg = get().config;
      // Auto-select the new model on whichever page slot is currently empty.
      // Convenient for first-time setup: the user adds one model and both
      // Generate + Edit instantly have a default selection.
      const next: AppConfig = {
        ...cfg,
        models: [...cfg.models, { ...partial, id }],
        selected_gen_model_id: cfg.selected_gen_model_id || id,
        selected_edit_model_id: cfg.selected_edit_model_id || id,
      };
      await writeConfig(next);
      return id;
    },

    updateModel: async (id, patch) => {
      const cfg = get().config;
      const next: AppConfig = {
        ...cfg,
        models: cfg.models.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      };
      await writeConfig(next);
    },

    removeModel: async (id) => {
      const cfg = get().config;
      const next: AppConfig = {
        ...cfg,
        models: cfg.models.filter((m) => m.id !== id),
        selected_gen_model_id: cfg.selected_gen_model_id === id ? "" : cfg.selected_gen_model_id,
        selected_edit_model_id: cfg.selected_edit_model_id === id ? "" : cfg.selected_edit_model_id,
      };
      await writeConfig(next);
    },

    addPreset: async (partial) => {
      const id = newId();
      const cfg = get().config;
      const next: AppConfig = {
        ...cfg,
        param_presets: [...cfg.param_presets, { ...partial, id }],
      };
      await writeConfig(next);
      return id;
    },

    updatePreset: async (id, patch) => {
      const cfg = get().config;
      const next: AppConfig = {
        ...cfg,
        param_presets: cfg.param_presets.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      };
      await writeConfig(next);
    },

    removePreset: async (id) => {
      const cfg = get().config;
      // Reset Generate / Edit's param-source back to "global" if either page
      // was referencing the preset being removed.
      const next: AppConfig = {
        ...cfg,
        param_presets: cfg.param_presets.filter((p) => p.id !== id),
        selected_gen_param_source:
          cfg.selected_gen_param_source === id ? "global" : cfg.selected_gen_param_source,
        selected_edit_param_source:
          cfg.selected_edit_param_source === id ? "global" : cfg.selected_edit_param_source,
      };
      await writeConfig(next);
    },
  };
});
