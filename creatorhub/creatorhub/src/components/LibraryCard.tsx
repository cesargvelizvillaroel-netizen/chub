"use client";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDuration, formatSize, Thumb } from "./ui";
import { LocalDate } from "./LocalDate";

export type LibraryVideo = { id: string; filename: string; size: number; durationSec: number; hasThumb: boolean; createdAt: string };

export function LibraryCard({ v }: { v: LibraryVideo }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`¿Eliminar "${v.filename}" de la biblioteca? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    const res = await fetch(`/api/videos/${v.id}`, { method: "DELETE" });
    if (res.ok) return router.refresh();
    setError((await res.json().catch(() => ({}))).error ?? "No se pudo eliminar.");
    setBusy(false);
  }

  return (
    <article className="card overflow-hidden">
      <Thumb videoId={v.id} hasThumb={v.hasThumb} className="aspect-[9/12] w-full" />
      <div className="space-y-3 p-3">
        <div>
          <p className="truncate text-sm font-medium" title={v.filename}>{v.filename}</p>
          <p className="text-xs text-muted">
            {formatSize(v.size)} · {formatDuration(v.durationSec)} · <LocalDate iso={v.createdAt} withTime={false} />
          </p>
        </div>
        {error && <p role="alert" className="text-xs text-err">{error}</p>}
        <div className="flex gap-2">
          <Link href={`/new?video=${v.id}`} className="btn-primary flex-1">Usar</Link>
          <Link href={`/export/${v.id}`} className="btn-ghost">Exportar</Link>
          <button onClick={remove} disabled={busy} className="btn-danger px-2.5" aria-label={`Eliminar ${v.filename}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
