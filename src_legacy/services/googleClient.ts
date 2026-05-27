import { fetch } from "@tauri-apps/plugin-http";
import { readFile } from "@tauri-apps/plugin-fs";
import type { AppConfig, Endpoint } from "./config";
import { normalizedBaseUrl } from "./config";
import { ApiError, type ImageResult, type ConnectionTestResult } from "./apiClientTypes";

/** Google Gemini's "Nano Banana" image API.
 *
 * Protocol differences from OpenAI:
 *  - URL:     `{base_url}/models/{model_id}:generateContent`
 *  - Auth:    `x-goog-api-key` header (NOT Bearer)
 *  - Body:    `contents[].parts[]` with text and/or inlineData (base64 image)
 *  - Output:  `candidates[].content.parts[].inlineData.data` (base64 PNG)
 *  - Caps:    No `n`, no `size`, no `quality`/`background`/`output_format`.
 *             You give it a prompt (and optionally an input image); you get
 *             one PNG back.
 *
 * Streaming is supported via `:streamGenerateContent?alt=sse` but Gemini
 * usually delivers the image as one base64 chunk at the end, not as
 * progressive previews. For now we keep it simple: streamGenerate is a
 * no-op wrapper over the non-streaming path. `onPartial` is never fired
 * — the user sees the final image when it arrives.
 */

const base64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

const mimeOf = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
};

function authHeaders(endpoint: Endpoint): Record<string, string> {
  return { "x-goog-api-key": endpoint.api_key };
}

async function readFileAsInlineData(path: string): Promise<{ mimeType: string; data: string }> {
  const bytes = await readFile(path);
  return { mimeType: mimeOf(path), data: bytesToBase64(new Uint8Array(bytes)) };
}

async function httpError(resp: Response): Promise<ApiError> {
  const body = await resp.text();
  let msg = `HTTP ${resp.status}`;
  try {
    const json = JSON.parse(body);
    if (json?.error?.message) msg += ` — ${json.error.message}`;
    else if (json?.message) msg += ` — ${json.message}`;
  } catch {
    if (body) msg += ` — ${body.slice(0, 200)}`;
  }
  return new ApiError(msg, resp.status, body);
}

/** Walk a Gemini response and pull every inlineData PNG out. */
function extractImages(parsed: unknown): ImageResult[] {
  const out: ImageResult[] = [];
  const candidates = (parsed as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }> })?.candidates;
  if (!Array.isArray(candidates)) return out;
  for (const c of candidates) {
    const parts = c?.content?.parts ?? [];
    for (const p of parts) {
      const data = p?.inlineData?.data;
      if (typeof data === "string" && data.length > 0) {
        out.push({ bytes: base64ToBytes(data) });
      }
    }
  }
  return out;
}

async function callGenerateContent(
  endpoint: Endpoint,
  modelId: string,
  body: unknown
): Promise<ImageResult[]> {
  const url = `${normalizedBaseUrl(endpoint.base_url)}/models/${encodeURIComponent(modelId)}:generateContent`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders(endpoint), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw await httpError(resp);
  const text = await resp.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e: any) {
    throw new ApiError(`响应 JSON 解析失败: ${e.message}`, resp.status, text);
  }
  const images = extractImages(parsed);
  if (images.length === 0) {
    throw new ApiError("Gemini 响应未包含任何图像数据", resp.status, text);
  }
  return images;
}

function buildGenerationConfig(cfg: AppConfig): Record<string, unknown> {
  const gc: Record<string, unknown> = { responseModalities: ["IMAGE", "TEXT"] };
  if (cfg.google_aspect_ratio && cfg.google_aspect_ratio !== "1:1") {
    // Nano Banana 2 / Pro accept aspectRatio under imageConfig. Older models
    // ignore it without error, so we send unconditionally when ≠ 1:1.
    gc.imageConfig = { aspectRatio: cfg.google_aspect_ratio };
  }
  return gc;
}

export async function googleGenerate(
  endpoint: Endpoint,
  modelId: string,
  cfg: AppConfig,
  prompt: string
): Promise<ImageResult[]> {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: buildGenerationConfig(cfg),
  };
  return callGenerateContent(endpoint, modelId, body);
}

export async function googleEdit(
  endpoint: Endpoint,
  modelId: string,
  cfg: AppConfig,
  imagePath: string,
  prompt: string
): Promise<ImageResult[]> {
  const inline = await readFileAsInlineData(imagePath);
  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: inline },
        ],
      },
    ],
    generationConfig: buildGenerationConfig(cfg),
  };
  return callGenerateContent(endpoint, modelId, body);
}

export async function googleTestConnection(endpoint: Endpoint): Promise<ConnectionTestResult> {
  if (!endpoint.api_key) return { ok: false, message: "API key is empty" };
  const url = `${normalizedBaseUrl(endpoint.base_url)}/models`;
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { ...authHeaders(endpoint), Accept: "application/json" },
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
      if (Array.isArray(j?.models)) modelCount = j.models.length;
    } catch {
      /* not JSON — OK, /models returned 200 */
    }
    return { ok: true, status: resp.status, message: "OK", modelCount };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
