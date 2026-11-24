import type { PlatformId } from "./meta";

export class PlatformError extends Error {
  constructor(message: string, public retryable = false) {
    super(message);
  }
}

export type TokenSet = { accessToken: string; refreshToken?: string; expiresAt?: Date };

export type PublishInput = {
  accessToken: string;
  externalAccountId: string;
  videoPath: string;
  mimeType: string;
  size: number;
  durationSec: number;
  title: string;
  description: string;
  hashtags: string[];
  settings: Record<string, any>;
  mediaToken: string; // para plataformas que descargan el video por URL pública
};

export type PublishResult = { externalId: string; url?: string; note?: string };

export interface PlatformAdapter {
  id: PlatformId;
  isConfigured(): boolean;
  authUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet & { externalId: string; displayName: string }>;
  refresh(acc: { accessToken: string; refreshToken?: string }): Promise<TokenSet>;
  publish(input: PublishInput): Promise<PublishResult>;
}

/** fetch + JSON con errores legibles. 429 y 5xx se marcan como reintentables. */
export async function api(url: string, init: RequestInit | undefined, what: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new PlatformError(`${what}: error de red (${(e as Error).message})`, true);
  }
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const m = data?.error?.message ?? data?.error_description ?? data?.message ?? data?.raw ?? text;
    throw new PlatformError(`${what} (${res.status}): ${String(typeof m === "string" ? m : JSON.stringify(m)).slice(0, 300)}`, res.status >= 500 || res.status === 429);
  }
  return data;
}

export const form = (o: Record<string, string>) => ({
  method: "POST" as const,
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(o),
});

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
