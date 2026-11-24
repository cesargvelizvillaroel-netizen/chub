import fs from "node:fs";
import { Readable } from "node:stream";
import { readMediaToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { filePath } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** URL temporal y firmada (1 hora) para que Instagram descargue el video. No expone la biblioteca. */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const videoId = readMediaToken(params.token);
  if (!videoId) return new Response("Enlace no válido o vencido", { status: 403 });
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) return new Response("No encontrado", { status: 404 });
  const file = filePath(video.storageKey);
  const stat = await fs.promises.stat(file).catch(() => null);
  if (!stat) return new Response("No encontrado", { status: 404 });

  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
  const base = { "Content-Type": video.mimeType, "Accept-Ranges": "bytes" };
  if (m) {
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? Math.min(parseInt(m[2], 10), stat.size - 1) : stat.size - 1;
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })) as any, {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)) as any, { headers: { ...base, "Content-Length": String(stat.size) } });
}
