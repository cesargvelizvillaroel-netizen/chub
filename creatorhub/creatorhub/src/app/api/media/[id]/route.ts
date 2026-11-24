import fs from "node:fs";
import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { bad, unauthorized } from "@/lib/http";
import { apiUser } from "@/lib/session";
import { filePath } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sirve el video (con soporte de Range para poder adelantar) o su miniatura, solo a su dueño. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const video = await prisma.video.findFirst({ where: { id: params.id, userId: user.id } });
  if (!video) return bad("No encontrado", 404);
  const url = new URL(req.url);
  const thumb = url.searchParams.get("thumb") === "1";
  if (thumb && !video.thumbKey) return bad("Sin miniatura", 404);

  const file = filePath(thumb ? video.thumbKey! : video.storageKey);
  const stat = await fs.promises.stat(file).catch(() => null);
  if (!stat) return bad("Archivo no disponible", 404);
  const type = thumb ? "image/jpeg" : video.mimeType;
  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
  if (url.searchParams.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(video.filename)}`;
  }

  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
  if (m && !thumb) {
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? Math.min(parseInt(m[2], 10), stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })) as any, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)) as any, { headers: { ...headers, "Content-Length": String(stat.size) } });
}
