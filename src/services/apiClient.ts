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
  imagePaths: string[],
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
  // OpenAI's multi-image convention: single file uses field name `image`,
  // multiple files use repeated `image[]` (PHP-style array). gpt-image-*
  // accepts arrays for compositing multiple references; dall-e ignores
  // anything beyond the first.
  if (imagePaths.length === 1) {
    form.append("image", await fileToFormPart(imagePaths[0]));
  } else {
    for (const path of imagePaths) {
      form.append("image[]", await fileToFormPart(path));
    }
  }
  if (maskPath) form.append("mask", await fileToFormPart(maskPath));
  applyGptImageParams(form, cfg, modelId);
  return form;
}

export async function edit(
  endpoint: Endpoint,
  modelId: string,
  cfg: AppConfig,
  imagePaths: string[],
  maskPath: string | null,
  prompt: string,
  size: string,
  n: number
): Promise<ImageResult[]> {
  if (endpoint.type === "google") return googleEdit(endpoint, modelId, cfg, imagePaths, prompt);

  const url = normalizedBaseUrl(endpoint.base_url) + "/images/edits";
  const form = await buildEditForm(modelId, cfg, imagePaths, maskPath, prompt, size, n, false);
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
  imagePaths: string[],
  maskPath: string | null,
  prompt: string,
  size: string,
  n: number,
  onPartial: (p: PartialImage) => void
): Promise<ImageResult[]> {
  if (endpoint.type === "google") return googleEdit(endpoint, modelId, cfg, imagePaths, prompt);

  const url = normalizedBaseUrl(endpoint.base_url) + "/images/edits";
  const form = await buildEditForm(modelId, cfg, imagePaths, maskPath, prompt, size, n, true);
  return await postSse(url, form, endpoint, onPartial);
}

// ───────── SSE parsing ─────────

/** Walk a few common locations for a base64 image payload. Different
 *  models / API revisions stick the b64 string in different fields:
 *  gpt-image-1 used `b64_json`, partial events use `partial_image_b64`,
 *  the Responses API can nest under `image` / `data` / `output[*]`. */
function findB64(ev: any): string | undefined {
  if (typeof ev?.b64_json === "string") return ev.b64_json;
  if (typeof ev?.partial_image_b64 === "string") return ev.partial_image_b64;
  if (typeof ev?.data?.b64_json === "string") return ev.data.b64_json;
  if (typeof ev?.image?.b64_json === "string") return ev.image.b64_json;
  if (Array.isArray(ev?.output)) {
    for (const o of ev.output) {
      const b = findB64(o);
      if (b) return b;
    }
  }
  return undefined;
}

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
  // Track every event type we see so we can put it in the error message
  // if we end up with zero results — much easier to diagnose than a flat
  // "no completed event" message.
  const seenTypes = new Set<string>();

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
        const type: string | undefined = ev?.type;
        if (type) seenTypes.add(type);

        // Match by suffix so we handle multiple naming conventions:
        //   image_generation.partial_image
        //   response.image_generation_call.partial_image
        //   image_edit.partial_image  (gpt-image-2 edit endpoint)
        //   …
        // Same for `.completed`. If a future event name differs by suffix
        // we just need to add another branch.
        const isPartial = typeof type === "string" && type.endsWith(".partial_image");
        const isCompleted = typeof type === "string" && type.endsWith(".completed");
        const b64 = findB64(ev);

        if (isPartial && b64) {
          onPartial({
            bytes: base64ToBytes(b64),
            index: Number(ev.partial_image_index ?? ev.index ?? 0),
          });
        } else if (isCompleted && b64) {
          results.push({ bytes: base64ToBytes(b64) });
        } else if (!isPartial && !isCompleted && b64) {
          // Unknown event type but it carries a b64 image — accept it as
          // a result rather than discarding (defensive against API
          // renames we haven't caught up to).
          results.push({ bytes: base64ToBytes(b64) });
        }
      } catch {
        /* skip malformed event */
      }
    }
  }

  if (results.length === 0) {
    const types = Array.from(seenTypes);
    const detail = types.length > 0
      ? `seen events: ${types.join(", ")}`
      : "no SSE events received";
    throw new ApiError(`流式响应未包含完成事件（${detail}）`);
  }
  return results;
}
