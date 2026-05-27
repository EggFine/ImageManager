export type EndpointType = "openai" | "google";

export interface PresetModel {
  model_id: string;
  label: string;
}

export const PRESET_MODELS: Record<EndpointType, PresetModel[]> = {
  openai: [
    { model_id: "gpt-image-2", label: "gpt-image-2" },
  ],
  google: [
    { model_id: "gemini-3.1-flash-image-preview", label: "Nano Banana 2" },
    { model_id: "gemini-3-pro-image-preview", label: "Nano Banana Pro" },
  ],
};

export const DEFAULT_BASE_URL: Record<EndpointType, string> = {
  openai: "https://api.openai.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
};

export const ENDPOINT_TYPE_LABEL: Record<EndpointType, string> = {
  openai: "OpenAI",
  google: "Google",
};
