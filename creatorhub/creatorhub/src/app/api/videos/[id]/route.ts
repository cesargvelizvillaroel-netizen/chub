import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, unauthorized } from "@/lib/http";
import { apiUser } from "@/lib/session";
import { removeFile } from "@/lib/storage";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const video = await prisma.video.findFirst({ where: { id: params.id, userId: user.id } });
  if (!video) return bad("Video no encontrado.", 404);
  const active = await prisma.postTarget.count({
    where: { post: { videoId: video.id }, status: { in: ["PENDING", "SCHEDULED", "PUBLISHING"] } },
  });
  if (active) return bad("Este video tiene publicaciones pendientes o programadas. Cancélalas primero.", 409);
  await prisma.video.delete({ where: { id: video.id } });
  await removeFile(video.storageKey);
  await removeFile(video.thumbKey);
  return NextResponse.json({ ok: true });
}
