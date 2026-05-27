/** Shared types between the OpenAI client and the Google (Gemini) client.
 *  Lives in its own module so each protocol implementation can import it
 *  without pulling in the other (and so callers can hold an `ImageResult`
 *  type without importing the protocol-specific functions). */

export interface ImageResult {
  bytes: Uint8Array;
  sourceUrl?: string;
}

export interface PartialImage {
  bytes: Uint8Array;
  index: number;
}

export interface ConnectionTestResult {
  ok: boolean;
  status?: number;
  message: string;
  /** Number of models the endpoint advertised, if /models returned a list. */
  modelCount?: number;
}

export class ApiError extends Error {
  status: number;
  rawBody?: string;
  constructor(message: string, status = 0, rawBody?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.rawBody = rawBody;
  }
}
