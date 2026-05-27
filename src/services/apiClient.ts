import { fetch } from "@tauri-apps/plugin-http";
import { readFile } from "@tauri-apps/plugin-fs";
import type { AppConfig, Endpoint } from "./config";
import { normalizedBaseUrl } from "./config";
import {
  ApiError,
  type ImageResult,
  type PartialImage,
  type ConnectionTestResult,
} from "./apiClientTypes";
import { googleEdit, googleGenerate, googleTestConnection } from "./googleClient";

// Re-export so existing callers can keep `import { ImageResult, ApiError, ... } from "./apiClient"`.
export { ApiError };
export type { ImageResult, PartialImage, ConnectionTestResult };

const base64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const mimeOf = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
};

const fileName = (path: string): string =>
  path.replace(/\\/g, "/").split("/").pop() ?? "image";

async function fileToFormPart(path: string): Promise<File> {
  const bytes = await readFile(path);
  return new File([new Blob([new Uint8Array(bytes)])], fileName(path), { type: mimeOf(path) });
}

function authHeader(endpoint: Endpoint): Record<string, string> {
  return { Authorization: `Bearer ${endpoint.api_key}` };
}

async function parseJsonResponse(body: string, status: number): Promise<ImageResult[]> {
  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch (e: any) {
    throw new ApiError(`响应 JSON 解析失败: ${e.message}`, status, body);
  }
  if (!parsed?.data || !Array.isArray(parsed.data))
    throw new ApiError("响应缺少 data 数组", status, body);

  const results: ImageResult[] = [];
  for (const item of parsed.data) {
    if (typeof item?.b64_json === "string") {
      results.push({ bytes: base64ToBytes(item.b64_json) });
    } else if (typeof item?.url === "string") {
      const resp = await fetch(item.url, { method: "GET" });
      if (!resp.ok) throw new ApiError(`下载 URL 失败: ${item.url}`, resp.status);
      const buf = await resp.arrayBuffer();
      results.push({ bytes: new Uint8Array(buf), sourceUrl: item.url });
    }
  }
  if (results.length === 0) throw new ApiError("响应未包含任何图像数据", status, body);
  return results;
}

async function httpError(resp: Response): Promise<ApiError> {
  const body = await resp.text();
  let msg = `HTTP ${resp.status}`;
  let parsed = false;
  try {
    const json = JSON.parse(body);
    if (json?.error?.message) {
      msg += ` — ${json.error.message}`;
      parsed = true;
    } else if (json?.message) {
      msg += ` — ${json.message}`;
      parsed = true;
    }
  } catch {
    /* not JSON */
  }
  if (!parsed && body) {
    const stripped = body.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (stripped) msg += ` — ${stripped.slice(0, 200)}`;
  }
  return new ApiError(msg, resp.status, body);
}

function isDallE(model: string): boolean {
  return model.toLowerCase().startsWith("dall-e");
}

function isGptImage(model: string): boolean {
  return model.toLowerCase().startsWith("gpt-image");
}

// ───────── Health check ─────────

/** Probe the endpoint for liveness. Routed by endpoint.type:
 *  - openai: GET {base_url}/models with Bearer
 *  - google: GET {base_url}/models with x-goog-api-key */
export async function testConnection(endpoint: Endpoint): Promise<ConnectionTestResult> {
  if (endpoint.type === "google") return googleTestConnection(endpoint);
  return openaiTestConnection(endpoint);
}

async function openaiTestConnection(endpoint: Endpoint): Promise<ConnectionTestResult> {
  if (!endpoint.api_key) return { ok: false, message: "API key is empty" };
  const url = normalizedBaseUrl(endpoint.base_url) + "/models";
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { ...authHeader(endpoint), Accept: "application/json" },
    });
    if (!resp.ok) {
      const text = await resp.text();
      let msg = `HTTP ${resp.status}`;
      try {
        const j = JSON.parse(text);
        if (j?.error?.message) msg += ` — ${j.error.message}`;
      } catch {
        if (text) msg += ` — ${text.slice(0, 160)}`;
      }
      return { ok: false, status: resp.status, message: msg };
    }
    let modelCount: number | undefined;
    try {
      const j = await resp.json();
      if (j?.data && Array.isArray(j.data)) modelCount = j.data.length;
    } catch {
      /* not JSON */
    }
    return { ok: true, status: resp.status, message: "OK", modelCount };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Append gpt-image-* only knobs (quality / output_format / background) to a
 *  JSON body or FormData. We only send values that differ from "auto" so we
 *  never force a particular default on the upstream model. */
function applyGptImageParams(target: Record<string, unknown> | FormData, cfg: AppConfig, model: string) {
  if (!isGptImage(model)) return;

  const set = (k: string, v: unknown) => {
    if (target instanceof FormData) target.append(k, String(v));
    else target[k] = v;
  };

  if (cfg.quality !== "auto") set("quality", cfg.quality);
  if (cfg.output_format !== "auto") {
    set("output_format", cfg.output_format);
    if (
      (cfg.output_format === "jpeg" || cfg.output_format === "webp") &&
      Number.isFinite(cfg.output_compression) &&
      cfg.output_compression >= 0 &&
      cfg.output_compression <= 100 &&
      cfg.output_compression !== 100
    ) {
      set("output_compression", cfg.output_compression);
    }
  }
  if (cfg.background !== "auto") set("background", cfg.background);
}

// ───────── Generations ─────────
export async function generate(
  endpoint: Endpoint,
  modelId: string,
  cfg: AppConfig,
  prompt: string,
  size: string,
  n: number
): Promise<ImageResult[]> {
  if (endpoint.type === "google") return googleGenerate(endpoint, modelId, cfg, prompt);
  return openaiGenerate(endpoint, modelId, cfg, prompt, size, n);
}

async function openaiGenerate(
  endpoint: Endpoint,
  modelId: string,
  cfg: AppConfig,
  prompt: string,
  size: string,
  n: number
): Promise<ImageResult[]> {
  const url = normalizedBaseUrl(endpoint.base_url) + "/images/generations";
  const body: Record<string, unknown> = { model: modelId, prompt, n, size };
  if (cfg.send_response_format && isDallE(modelId)) {
    body.response_format = "b64_json";
  }
  applyGptImageParams(body, cfg, modelId);

  const resp = await fetch(url, {
    method: "POST",
    headers: { ...authHeader(endpoint), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw await httpError(resp);
  return parseJsonResponse(await resp.text(), resp.status);
}

export async function generateStream(
  endpoint: Endpoint,
  modelId: string,
  cfg: AppConfig,
  prompt: string,
  size: string,
  n: number,
  onPartial: (p: PartialImage) => void
): Promise<ImageResult[]> {
  // Gemini's streaming for image gen doesn't emit progressive previews
  // the way OpenAI's gpt-image-* does, so we fall back to the regular
  // non-streaming call. onPartial is never fired.
  if (endpoint.type === "google") return googleGenerate(endpoint, modelId, cfg, prompt);

  const url = normalizedBaseUrl(endpoint.base_url) + "/images/generations";
  const body: Record<string, unknown> = {
    model: modelId,
    prompt,
    n,
    size,
    stream: true,
  };
  if (cfg.send_response_format && isDallE(modelId)) {
    body.response_format = "b64_json";
  }
  if (cfg.partial_images > 0) body.partial_images = cfg.partial_images;
  applyGptImageParams(body, cfg, modelId);

  return await postSse(url, JSON.stringify(body), endpoint, onPartial, "application/json");
}

// ───────── Edits ─────────
async function buildEditForm(
  modelId: string,
  cfg: AppConfig,
  imagePath: string,
  maskPath: string | null,
  prompt: string,
  size: string,
  n: number,
  stream: boolean
): Promise<FormData> {
  const form = new FormData();
  form.append("model", modelId);
  form.append("prompt", prompt);
  form.append("n", String(n));
  form.append("size", size);
  if (cfg.send_response_format && isDallE(modelId)) {
    form.append("response_format", "b64_json");
  }

  const isImg2 = modelId.toLowerCase().startsWith("gpt-image-2");
  if (!isImg2 && (cfg.input_fidelity === "high" || cfg.input_fidelity === "low")) {
    form.append("input_fidelity", cfg.input_fidelity);
  }
  if (stream) {
    form.append("stream", "true");
    if (cfg.partial_images > 0) form.append("partial_images", String(cfg.partial_images));
  }
  form.append("image", await fileToFormPart(imagePath));
  if (maskPath) form.append("mask", await fileToFormPart(maskPath));
  applyGptImageParams(form, cfg, modelId);
  return form;
}

export async function edit(
  endpoint: Endpoint,
  modelId: string,
  cfg: AppConfig,
  imagePath: string,
  maskPath: string | null,
  prompt: string,
  size: string,
  n: number
): Promise<ImageResult[]> {
  if (endpoint.type === "google") return googleEdit(endpoint, modelId, cfg, imagePath, prompt);

  const url = normalizedBaseUrl(endpoint.base_url) + "/images/edits";
  const form = await buildEditForm(modelId, cfg, imagePath, maskPath, prompt, size, n, false);
  const resp = await fetch(url, {
    method: "POST",
    headers: { ...authHeader(endpoint), Accept: "application/json" },
    body: form,
  });
  if (!resp.ok) throw await httpError(resp);
  return parseJsonResponse(await resp.text(), resp.status);
}

export async function editStream(
  endpoint: Endpoint,
  modelId: string,
  cfg: AppConfig,
  imagePath: string,
  maskPath: string | null,
  prompt: string,
  size: string,
  n: number,
  onPartial: (p: PartialImage) => void
): Promise<ImageResult[]> {
  if (endpoint.type === "google") return googleEdit(endpoint, modelId, cfg, imagePath, prompt);

  const url = normalizedBaseUrl(endpoint.base_url) + "/images/edits";
  const form = await buildEditForm(modelId, cfg, imagePath, maskPath, prompt, size, n, true);
  return await postSse(url, form, endpoint, onPartial);
}

// ───────── SSE parsing ─────────
async function postSse(
  url: string,
  body: string | FormData,
  endpoint: Endpoint,
  onPartial: (p: PartialImage) => void,
  contentType?: string
): Promise<ImageResult[]> {
  const headers: Record<string, string> = { ...authHeader(endpoint), Accept: "text/event-stream" };
  if (contentType) headers["Content-Type"] = contentType;
  const resp = await fetch(url, { method: "POST", headers, body });
  if (!resp.ok) throw await httpError(resp);

  const reader = resp.body?.getReader();
  if (!reader) throw new ApiError("响应不支持流式读取");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const results: ImageResult[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let eventBoundary;
    while ((eventBoundary = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, eventBoundary);
      buffer = buffer.slice(eventBoundary + 2);
      const dataLines = chunk
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => (l.startsWith("data: ") ? l.slice(6) : l.slice(5)));
      if (dataLines.length === 0) continue;
      const payload = dataLines.join("\n").trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const ev = JSON.parse(payload);
        if (ev.type === "image_generation.partial_image" || ev.type === "response.image_generation_call.partial_image") {
          const b64 = ev.b64_json ?? ev.partial_image_b64;
          if (typeof b64 === "string") {
            onPartial({ bytes: base64ToBytes(b64), index: Number(ev.partial_image_index ?? 0) });
          }
        } else if (ev.type === "image_generation.completed" || ev.type === "response.image_generation_call.completed") {
          const b64 = ev.b64_json;
          if (typeof b64 === "string") {
            results.push({ bytes: base64ToBytes(b64) });
          }
        }
      } catch {
        /* skip malformed event */
      }
    }
  }

  if (results.length === 0) throw new ApiError("流式响应未包含 completed 事件");
  return results;
}
