import fs from "node:fs";
import { Readable } from "node:stream";
import { PlatformError } from "./types";

/** Sube un archivo (o un rango) con PUT en streaming. Si se corta la conexión NO se reintenta solo, para no duplicar publicaciones. */
export async function putFile(
  url: string,
  headers: Record<string, string>,
  path: string,
  range: { start: number; end: number } | undefined,
  what: string
): Promise<Response> {
  try {
    const body = Readable.toWeb(fs.createReadStream(path, range)) as unknown as BodyInit;
    return await fetch(url, { method: "PUT", headers, body, duplex: "half" } as RequestInit);
  } catch (e) {
    throw new PlatformError(
      `${what}: se interrumpió la conexión durante la subida. Revisa la plataforma antes de reintentar para evitar duplicados (${(e as Error).message}).`,
      false
    );
  }
}
