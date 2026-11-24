import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, unauthorized } from "@/lib/http";
import { apiUser } from "@/lib/session";
import { saveStream, TooLargeError } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El navegador envía el archivo como cuerpo crudo; se escribe a disco en streaming (sin cargarlo entero en memoria).
export async function PUT(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") ?? "video.mp4").slice(0, 200);
  const mime = req.headers.get("content-type") ?? "";
  if (!mime.startsWith("video/")) return bad("Solo se permiten archivos de video.");
  if (!req.body) return bad("Archivo vacío.");

  const maxMb = Number(process.env.MAX_UPLOAD_MB ?? 500);
  const ext = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".mp4";
  try {
    const { key, size } = await saveStream(Readable.fromWeb(req.body as any), ext, maxMb * 1024 * 1024);
    const video = await prisma.video.create({
      data: { userId: user.id, filename: name, storageKey: key, mimeType: mime, size, durationSec: Number(url.searchParams.get("duration")) || 0 },
    });
    return NextResponse.json({ id: video.id, filename: video.filename, size: video.size, durationSec: video.durationSec });
  } catch (e) {
    if (e instanceof TooLargeError) return bad(`El archivo supera el máximo de ${maxMb} MB.`, 413);
    console.error(e);
    return bad("No se pudo guardar el video.", 500);
  }
}
