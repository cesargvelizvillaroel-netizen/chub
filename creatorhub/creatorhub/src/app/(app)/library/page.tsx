import { Search } from "lucide-react";
import Link from "next/link";
import { LibraryCard } from "@/components/LibraryCard";
import { Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function Library({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireUser();
  const q = searchParams.q?.trim();
  const videos = await prisma.video.findMany({
    where: { userId: user.id, ...(q ? { filename: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader title="Biblioteca" subtitle="Todos los videos que has subido. Reutilízalos en nuevas publicaciones." action={<Link href="/new" className="btn-primary">Subir un video</Link>} />
      <form className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
        <input name="q" defaultValue={q} placeholder="Buscar por nombre" aria-label="Buscar videos por nombre" className="input pl-9" />
      </form>
      {videos.length === 0 ? (
        <Empty title={q ? "No hay videos con ese nombre" : "Tu biblioteca está vacía"}>
          {!q && <Link href="/new" className="btn-primary">Subir el primer video</Link>}
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {videos.map((v) => (
            <LibraryCard key={v.id} v={{ id: v.id, filename: v.filename, size: v.size, durationSec: v.durationSec, hasThumb: !!v.thumbKey, createdAt: v.createdAt.toISOString() }} />
          ))}
        </div>
      )}
    </>
  );
}
