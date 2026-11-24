import Link from "next/link";
import { HistoryActions } from "@/components/HistoryActions";
import { LocalDate } from "@/components/LocalDate";
import { Empty, PageHeader, PlatformLabel, StatusBadge, Thumb } from "@/components/ui";
import { prisma } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/platforms/meta";
import { requireUser } from "@/lib/session";

const FILTERS = ["PUBLISHED", "PENDING", "SCHEDULED", "FAILED"] as const;

export default async function HistoryPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = await requireUser();
  const status = FILTERS.find((s) => s === searchParams.status);
  const where = {
    post: { userId: user.id },
    ...(status === "PENDING" ? { status: { in: ["PENDING" as const, "PUBLISHING" as const] } } : status ? { status } : {}),
  };
  const targets = await prisma.postTarget.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { post: { include: { video: true } } } });

  return (
    <>
      <PageHeader title="Historial" subtitle="El estado real de cada publicación, plataforma por plataforma." />
      <div className="mb-5 flex flex-wrap gap-2">
        {[undefined, ...FILTERS].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/history?status=${s}` : "/history"}
            className={`rounded-full border px-3 py-1.5 text-sm ${s === status ? "border-accent text-accent" : "border-line text-muted hover:text-ink"}`}
          >
            {s ? STATUS_LABEL[s] : "Todas"}
          </Link>
        ))}
      </div>

      {targets.length === 0 ? (
        <Empty title="No hay publicaciones para mostrar">
          <Link href="/new" className="btn-primary">Crear una publicación</Link>
        </Empty>
      ) : (
        <ul className="space-y-3">
          {targets.map((t) => (
            <li key={t.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <Thumb videoId={t.post.videoId} hasThumb={!!t.post.video?.thumbKey} className="h-20 w-14 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-medium">{t.post.videoName}</p>
                <p className="truncate text-sm text-muted">{t.title}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <PlatformLabel p={t.platform} />
                  <span>
                    {t.status === "PUBLISHED" ? "Publicado " : t.status === "SCHEDULED" ? "Programado para " : "Creado "}
                    <LocalDate iso={(t.status === "PUBLISHED" ? t.publishedAt : t.status === "SCHEDULED" ? t.scheduledAt : t.createdAt)?.toISOString()} />
                  </span>
                </div>
                {t.errorMessage && <p className="text-xs text-err">{t.errorMessage}</p>}
                {t.note && <p className="text-xs text-info">{t.note}</p>}
              </div>
              <div className="flex flex-col items-start gap-3 sm:items-end">
                <StatusBadge status={t.status} />
                <HistoryActions id={t.id} status={t.status} videoId={t.post.videoId} url={t.externalUrl} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
