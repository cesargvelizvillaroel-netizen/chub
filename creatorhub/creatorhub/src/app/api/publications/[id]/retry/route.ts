import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, unauthorized } from "@/lib/http";
import { apiUser } from "@/lib/session";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const r = await prisma.postTarget.updateMany({
    where: { id: params.id, post: { userId: user.id }, status: "FAILED" },
    data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), errorMessage: null, lockedAt: null },
  });
  return r.count ? NextResponse.json({ ok: true }) : bad("Solo se pueden reintentar las publicaciones con error.", 409);
}
