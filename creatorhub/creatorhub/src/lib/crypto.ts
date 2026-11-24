import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function key(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (!k || !/^[0-9a-fA-F]{64}$/.test(k)) {
    throw new Error("ENCRYPTION_KEY debe tener exactamente 64 caracteres hexadecimales (revisa tu .env).");
  }
  return Buffer.from(k, "hex");
}

/** Cifra texto (tokens de las redes) con AES-256-GCM. */
export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

function sig(value: string): string {
  return createHmac("sha256", key()).update(value).digest("hex");
}

/** Token temporal y firmado para que una plataforma (Instagram) descargue un video por URL pública. */
export function makeMediaToken(videoId: string, ttlMs = 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  return `${videoId}.${exp}.${sig(`media:${videoId}:${exp}`)}`;
}

export function readMediaToken(token: string): string | null {
  const [videoId, exp, s] = token.split(".");
  if (!videoId || !exp || !s || Number(exp) < Date.now()) return null;
  const a = Buffer.from(s);
  const b = Buffer.from(sig(`media:${videoId}:${exp}`));
  return a.length === b.length && timingSafeEqual(a, b) ? videoId : null;
}
