import { CalendarClock, CheckCircle2, Clock, TriangleAlert, UploadCloud } from "lucide-react";
import Link from "next/link";
import { LocalDate } from "@/components/LocalDate";
import { Empty, PageHeader, PlatformLabel, StatusBadge, Thumb } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function Dashboard() {
  const user = await requireUser();
  const own = { post: { userId: user.id } };
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6);

  const [videosPublished, pending, scheduled, failed, recent, lastWeek] = await Promise.all([
    prisma.post.count({ where: { userId: user.id, targets: { some: { status: "PUBLISHED" } } } }),
    prisma.postTarget.count({ where: { ...own, status: { in: ["PENDING", "PUBLISHING"] } } }),
    prisma.postTarget.count({ where: { ...own, status: "SCHEDULED" } }),
    prisma.postTarget.count({ where: { ...own, status: "FAILED" } }),
    prisma.postTarget.findMany({ where: { ...own, status: { not: "CANCELED" } }, orderBy: { updatedAt: "desc" }, take: 8, include: { post: { include: { video: true } } } }),
    prisma.postTarget.findMany({ where: { ...own, status: "PUBLISHED", publishedAt: { gte: since } }, select: { publishedAt: true } }),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    return { d, n: 0 };
  });
  for (const t of lastWeek) {
    const slot = days.find((x) => x.d.toDateString() === t.publishedAt!.toDateString());
    if (slot) slot.n++;
  }
  const max = Math.max(1, ...days.map((x) => x.n));

  const stats = [
    { label: "Videos publicados", value: videosPublished, icon: CheckCircle2, tone: "text-ok" },
    { label: "Publicaciones pendientes", value: pending, icon: Clock, tone: "text-warn" },
    { label: "Programadas", value: scheduled, icon: CalendarClock, tone: "text-sched" },
    { label: "Con error", value: failed, icon: TriangleAlert, tone: "text-err" },
  ];

  return (
    <>
      <PageHeader
        title={`Hola, ${user.name.split(" ")[0]}`}
        subtitle="Esto es lo que pasa con tus publicaciones."
        action={<Link href="/new" className="btn-primary"><UploadCloud className="h-4 w-4" /> Subir un nuevo video</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card p-4">
            <Icon className={`h-5 w-5 ${tone}`} />
            <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
            <p className="text-sm text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Actividad reciente</h2>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Aún no hay actividad. Sube tu primer video para empezar.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <Thumb videoId={t.post.videoId} hasThumb={!!t.post.video?.thumbKey} className="h-12 w-9 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                      <PlatformLabel p={t.platform} /> <LocalDate iso={t.updatedAt.toISOString()} />
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-lg font-semibold">Publicadas esta semana</h2>
          <div className="flex h-40 items-end gap-2" role="img" aria-label="Publicaciones por día durante los últimos 7 días">
            {days.map(({ d, n }) => (
              <div key={d.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-xs text-muted">{n || ""}</span>
                <div className="w-full rounded-t bg-accent/80" style={{ height: `${Math.max(4, (n / max) * 100)}%`, opacity: n ? 1 : 0.2 }} />
                <span className="text-xs text-muted">{d.toLocaleDateString("es", { weekday: "short" }).slice(0, 2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-2">
            <Link href="/library" className="btn-ghost">Usar un video de la biblioteca</Link>
            <Link href="/accounts" className="btn-ghost">Cuentas conectadas</Link>
          </div>
        </section>
      </div>
    </>
  );
}
