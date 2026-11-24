import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PlatformIcon } from "@/components/ui";
import { ScheduledItem } from "@/components/ScheduledItem";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default async function CalendarPage({ searchParams }: { searchParams: { m?: string } }) {
  const user = await requireUser();
  const match = /^(\d{4})-(\d{2})$/.exec(searchParams.m ?? "");
  const first = match ? new Date(+match[1], +match[2] - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const next = new Date(first.getFullYear(), first.getMonth() + 1, 1);
  const prev = new Date(first.getFullYear(), first.getMonth() - 1, 1);

  const own = { post: { userId: user.id } };
  const [monthItems, upcoming] = await Promise.all([
    prisma.postTarget.findMany({
      where: { ...own, status: { not: "CANCELED" }, OR: [{ scheduledAt: { gte: first, lt: next } }, { publishedAt: { gte: first, lt: next } }] },
      include: { post: true },
    }),
    prisma.postTarget.findMany({
      where: { ...own, status: { in: ["PENDING", "SCHEDULED"] } },
      orderBy: { nextAttemptAt: "asc" },
      include: { post: { include: { video: true } } },
    }),
  ]);

  const byDay = new Map<number, typeof monthItems>();
  for (const t of monthItems) {
    const day = (t.scheduledAt ?? t.publishedAt)!.getDate();
    byDay.set(day, [...(byDay.get(day) ?? []), t]);
  }
  const offset = (first.getDay() + 6) % 7; // semana que empieza en lunes
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const today = new Date();

  return (
    <>
      <PageHeader title="Calendario" subtitle="Programa publicaciones y consulta lo que está por salir." action={<Link href="/new" className="btn-primary">Programar publicación</Link>} />

      <section className="card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <Link href={`/calendar?m=${ym(prev)}`} className="btn-ghost px-2.5" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></Link>
          <h2 className="text-lg font-semibold capitalize">{first.toLocaleDateString("es", { month: "long", year: "numeric" })}</h2>
          <Link href={`/calendar?m=${ym(next)}`} className="btn-ghost px-2.5" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {["L", "M", "X", "J", "V", "S", "D"].map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const items = byDay.get(day) ?? [];
            const isToday = today.getFullYear() === first.getFullYear() && today.getMonth() === first.getMonth() && today.getDate() === day;
            return (
              <div key={i} className={`min-h-16 rounded-lg border p-1.5 sm:min-h-20 ${isToday ? "border-accent" : "border-line"}`}>
                <p className={`text-xs ${isToday ? "font-semibold text-accent" : "text-muted"}`}>{day}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {items.slice(0, 4).map((t) => (
                    <span key={t.id} title={`${t.title} (${t.status})`} className={t.status === "PUBLISHED" ? "opacity-50" : ""}>
                      <PlatformIcon p={t.platform} className="h-3.5 w-3.5" />
                    </span>
                  ))}
                  {items.length > 4 && <span className="text-[10px] text-muted">+{items.length - 4}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Pendientes y programadas</h2>
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted">No tienes publicaciones pendientes.</p>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((t) => (
            <ScheduledItem
              key={t.id}
              t={{ id: t.id, platform: t.platform, title: t.title, description: t.description, status: t.status, when: t.nextAttemptAt.toISOString(), videoId: t.post.videoId, hasThumb: !!t.post.video?.thumbKey, videoName: t.post.videoName }}
            />
          ))}
        </ul>
      )}
    </>
  );
}
