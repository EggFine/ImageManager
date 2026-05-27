import { create } from "zustand";
import { AppConfig, defaultConfig, getConfigPath, loadConfig, saveConfig } from "./config";

interface ConfigStore {
  config: AppConfig;
  ready: boolean;
  configPath: string;
  init: () => Promise<void>;
  update: (patch: Partial<AppConfig>) => Promise<void>;
  setStatus: (text: string) => void;
  status: string;
}

export const useConfig = create<ConfigStore>((set, get) => ({
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
    set({ config: next });
    await saveConfig(next);
  },
  setStatus: (text) => set({ status: text }),
}));
