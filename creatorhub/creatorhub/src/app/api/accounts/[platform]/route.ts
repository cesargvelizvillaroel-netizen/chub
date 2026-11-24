import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, unauthorized } from "@/lib/http";
import { slugToPlatform } from "@/lib/platforms";
import { apiUser } from "@/lib/session";

export async function DELETE(_: Request, { params }: { params: { platform: string } }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const platform = slugToPlatform(params.platform);
  if (!platform) return bad("Plataforma desconocida.", 404);
  await prisma.socialAccount.deleteMany({ where: { userId: user.id, platform } });
  return NextResponse.json({ ok: true });
}
