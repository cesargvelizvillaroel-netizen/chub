import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, unauthorized } from "@/lib/http";
import { apiUser } from "@/lib/session";
import { removeFile, saveBuffer } from "@/lib/storage";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const video = await prisma.video.findFirst({ where: { id: params.id, userId: user.id } });
  if (!video) return bad("Video no encontrado.", 404);
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length || buf.length > 2 * 1024 * 1024) return bad("Miniatura no válida.");
  const key = await saveBuffer(buf, ".jpg");
  await removeFile(video.thumbKey);
  await prisma.video.update({ where: { id: video.id }, data: { thumbKey: key } });
  return NextResponse.json({ ok: true });
}
