import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { bad, unauthorized } from "@/lib/http";
import { normalizeTag, PLATFORMS, validateDraft } from "@/lib/platforms/meta";
import { apiUser } from "@/lib/session";

const target = z.object({
  platform: z.enum(["YOUTUBE", "TIKTOK", "INSTAGRAM"]),
  title: z.string().trim().min(1).max(2200),
  description: z.string().max(5000).default(""),
  hashtags: z.array(z.string()).max(40),
  settings: z.record(z.any()).default({}),
});
const schema = z.object({
  videoId: z.string(),
  scheduledAt: z.string().datetime().nullable().optional(),
  targets: z.array(target).min(1).max(3),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Datos de publicación no válidos.");
  const { videoId, scheduledAt, targets } = p.data;

  const video = await prisma.video.findFirst({ where: { id: videoId, userId: user.id } });
  if (!video) return bad("Video no encontrado.", 404);

  const when = scheduledAt ? new Date(scheduledAt) : null;
  if (when && when.getTime() < Date.now() - 60_000) return bad("La fecha programada ya pasó.");

  const platforms = new Set<string>();
  const rows = [];
  for (const t of targets) {
    if (platforms.has(t.platform)) return bad("Plataforma repetida.");
    platforms.add(t.platform);
    const hashtags = [...new Set(t.hashtags.map(normalizeTag).filter(Boolean))];
    const errs = validateDraft(t.platform, { title: t.title, description: t.description, hashtags }, video.durationSec);
    if (errs.length) return bad(`${PLATFORMS[t.platform].label}: ${errs[0]}`);
    rows.push({ ...t, hashtags });
  }
  const accounts = await prisma.socialAccount.findMany({ where: { userId: user.id, platform: { in: [...platforms] as any } } });
  for (const pl of platforms) {
    if (!accounts.some((a) => a.platform === pl)) return bad(`Conecta tu cuenta de ${PLATFORMS[pl as keyof typeof PLATFORMS].label} primero.`);
  }

  const post = await prisma.post.create({
    data: {
      userId: user.id,
      videoId: video.id,
      videoName: video.filename,
      targets: {
        create: rows.map((t) => ({
          platform: t.platform,
          title: t.title,
          description: t.description,
          hashtags: t.hashtags,
          settings: t.settings,
          status: when ? "SCHEDULED" : "PENDING",
          scheduledAt: when,
          nextAttemptAt: when ?? new Date(),
        })),
      },
    },
  });
  return NextResponse.json({ id: post.id });
}
