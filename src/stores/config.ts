import { defineStore } from "pinia";
import {
  defaultConfig,
  getConfigPath,
  loadConfig,
  newId,
  saveConfig,
} from "@/services/config";
import type { AppConfig, Endpoint, ModelEntry, ParamPreset } from "@/services/config";

interface State {
  config: AppConfig;
  ready: boolean;
  configPath: string;
  status: string;
}

/** Mirror of the legacy zustand `useConfig` store, ported to Pinia.
 *  Shape and method names are preserved so callers can be ported with
 *  minimal churn — only `useConfig()` access pattern changes. */
export const useConfigStore = defineStore("config", {
  state: (): State => ({
    config: { ...defaultConfig },
    ready: false,
    configPath: "",
    status: "",
  }),

  actions: {
    async _writeConfig(next: AppConfig) {
      this.config = next;
      await saveConfig(next);
    },

    async init() {
      const path = await getConfigPath();
      const cfg = await loadConfig();
      this.configPath = path;
      this.config = cfg;
      this.ready = true;
    },

    async update(patch: Partial<AppConfig>) {
      await this._writeConfig({ ...this.config, ...patch });
    },

    setStatus(text: string) {
      this.status = text;
    },

    async addEndpoint(partial: Omit<Endpoint, "id">): Promise<string> {
      const id = newId();
      await this._writeConfig({
        ...this.config,
        endpoints: [...this.config.endpoints, { ...partial, id }],
      });
      return id;
    },

    async updateEndpoint(id: string, patch: Partial<Omit<Endpoint, "id">>) {
      await this._writeConfig({
        ...this.config,
        endpoints: this.config.endpoints.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      });
    },

    async removeEndpoint(id: string) {
      const cfg = this.config;
      const removedModelIds = new Set(
        cfg.models.filter((m) => m.endpoint_id === id).map((m) => m.id)
      );
      await this._writeConfig({
        ...cfg,
        endpoints: cfg.endpoints.filter((e) => e.id !== id),
        models: cfg.models.filter((m) => m.endpoint_id !== id),
        selected_gen_model_id: removedModelIds.has(cfg.selected_gen_model_id)
          ? ""
          : cfg.selected_gen_model_id,
        selected_edit_model_id: removedModelIds.has(cfg.selected_edit_model_id)
          ? ""
          : cfg.selected_edit_model_id,
      });
    },

    async addModel(partial: Omit<ModelEntry, "id">): Promise<string> {
      const id = newId();
      const cfg = this.config;
      await this._writeConfig({
        ...cfg,
        models: [...cfg.models, { ...partial, id }],
        selected_gen_model_id: cfg.selected_gen_model_id || id,
        selected_edit_model_id: cfg.selected_edit_model_id || id,
      });
      return id;
    },

    async updateModel(id: string, patch: Partial<Omit<ModelEntry, "id">>) {
      await this._writeConfig({
        ...this.config,
        models: this.config.models.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      });
    },

    async removeModel(id: string) {
      const cfg = this.config;
      await this._writeConfig({
        ...cfg,
        models: cfg.models.filter((m) => m.id !== id),
        selected_gen_model_id: cfg.selected_gen_model_id === id ? "" : cfg.selected_gen_model_id,
        selected_edit_model_id: cfg.selected_edit_model_id === id ? "" : cfg.selected_edit_model_id,
      });
    },

    async addPreset(partial: Omit<ParamPreset, "id">): Promise<string> {
      const id = newId();
      await this._writeConfig({
        ...this.config,
        param_presets: [...this.config.param_presets, { ...partial, id }],
      });
      return id;
    },

    async updatePreset(id: string, patch: Partial<Omit<ParamPreset, "id">>) {
      await this._writeConfig({
        ...this.config,
        param_presets: this.config.param_presets.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      });
    },

    async removePreset(id: string) {
      const cfg = this.config;
      await this._writeConfig({
        ...cfg,
        param_presets: cfg.param_presets.filter((p) => p.id !== id),
        selected_gen_param_source:
          cfg.selected_gen_param_source === id ? "global" : cfg.selected_gen_param_source,
        selected_edit_param_source:
          cfg.selected_edit_param_source === id ? "global" : cfg.selected_edit_param_source,
      });
    },
  },
});
