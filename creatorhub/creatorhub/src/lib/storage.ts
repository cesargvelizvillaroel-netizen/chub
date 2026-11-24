// Almacenamiento de archivos. Hoy usa disco local; para pasar a S3/MinIO basta
// con reemplazar estas funciones manteniendo la misma firma.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const root = () => path.resolve(process.env.STORAGE_DIR ?? "./storage");

export function filePath(key: string): string {
  const p = path.resolve(root(), key);
  if (!p.startsWith(root() + path.sep)) throw new Error("Ruta de archivo no válida");
  return p;
}

export class TooLargeError extends Error {}

export async function saveStream(stream: Readable, ext: string, maxBytes: number) {
  const key = `${randomUUID()}${ext}`;
  const dest = filePath(key);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  let size = 0;
  const counter = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length;
      size > maxBytes ? cb(new TooLargeError()) : cb(null, chunk);
    },
  });
  try {
    await pipeline(stream, counter, fs.createWriteStream(dest));
  } catch (e) {
    await fs.promises.rm(dest, { force: true });
    throw e;
  }
  return { key, size };
}

export async function saveBuffer(buf: Buffer, ext: string) {
  const key = `${randomUUID()}${ext}`;
  const dest = filePath(key);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, buf);
  return key;
}

export async function removeFile(key?: string | null) {
  if (key) await fs.promises.rm(filePath(key), { force: true });
}
