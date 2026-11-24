import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { bad, unauthorized } from "@/lib/http";
import { validateDraft } from "@/lib/platforms/meta";
import { apiUser } from "@/lib/session";

const OPEN = ["PENDING", "SCHEDULED"] as const;

const patch = z.object({
  scheduledAt: z.string().datetime().optional(),
  title: z.string().trim().min(1).max(2200).optional(),
  description: z.string().max(5000).optional(),
});

// Modificar una publicación que todavía no salió.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const p = patch.safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Datos no válidos.");
  const t = await prisma.postTarget.findFirst({
    where: { id: params.id, post: { userId: user.id }, status: { in: [...OPEN] } },
    include: { post: { include: { video: true } } },
  });
  if (!t) return bad("Esta publicación ya no se puede modificar.", 409);

  const title = p.data.title ?? t.title;
  const description = p.data.description ?? t.description;
  const errs = validateDraft(t.platform, { title, description, hashtags: t.hashtags }, t.post.video?.durationSec ?? 0);
  if (errs.length) return bad(errs[0]);
  const data: Prisma.PostTargetUpdateManyMutationInput = { title, description };
  if (p.data.scheduledAt) {
    const when = new Date(p.data.scheduledAt);
    if (when.getTime() < Date.now() - 60_000) return bad("La fecha programada ya pasó.");
    data.scheduledAt = when;
    data.nextAttemptAt = when;
    data.status = "SCHEDULED";
    data.errorMessage = null;
  }
  const r = await prisma.postTarget.updateMany({ where: { id: t.id, status: { in: [...OPEN] } }, data });
  return r.count ? NextResponse.json({ ok: true }) : bad("Esta publicación ya está en proceso.", 409);
}

// Cancelar (solo si todavía no empezó a publicarse).
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const r = await prisma.postTarget.updateMany({
    where: { id: params.id, post: { userId: user.id }, status: { in: [...OPEN] } },
    data: { status: "CANCELED", errorMessage: null },
  });
  return r.count ? NextResponse.json({ ok: true }) : bad("Esta publicación ya no se puede cancelar.", 409);
}
