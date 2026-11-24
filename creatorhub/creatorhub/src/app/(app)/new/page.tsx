import { NewPublicationForm, type VideoInfo } from "@/components/NewPublicationForm";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import type { PlatformId } from "@/lib/platforms/meta";
import { requireUser } from "@/lib/session";

const toInfo = (v: { id: string; filename: string; size: number; durationSec: number; thumbKey: string | null }): VideoInfo => ({
  id: v.id, filename: v.filename, size: v.size, durationSec: v.durationSec, hasThumb: !!v.thumbKey,
});

export default async function NewPublication({ searchParams }: { searchParams: { video?: string } }) {
  const user = await requireUser();
  const [accounts, library, initial] = await Promise.all([
    prisma.socialAccount.findMany({ where: { userId: user.id }, select: { platform: true } }),
    prisma.video.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    searchParams.video ? prisma.video.findFirst({ where: { id: searchParams.video, userId: user.id } }) : null,
  ]);

  return (
    <>
      <PageHeader title="Nueva publicación" subtitle="Sube el video una vez y elige dónde publicarlo." />
      <NewPublicationForm
        connected={accounts.map((a) => a.platform as PlatformId)}
        library={library.map(toInfo)}
        initialVideo={initial ? toInfo(initial) : null}
      />
    </>
  );
}
