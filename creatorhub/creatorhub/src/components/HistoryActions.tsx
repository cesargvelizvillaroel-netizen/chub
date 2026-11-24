"use client";
import { ExternalLink, RotateCw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function HistoryActions({ id, status, videoId, url }: { id: string; status: string; videoId: string | null; url: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function call(method: "POST" | "DELETE", path: string) {
    setBusy(true);
    setError("");
    const res = await fetch(path, { method });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "No se pudo completar la acción.");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "FAILED" && (
        <button className="btn-ghost" disabled={busy} onClick={() => call("POST", `/api/publications/${id}/retry`)}>
          <RotateCw className="h-4 w-4" /> Reintentar
        </button>
      )}
      {(status === "PENDING" || status === "SCHEDULED") && (
        <button className="btn-danger" disabled={busy} onClick={() => confirm("¿Cancelar esta publicación?") && call("DELETE", `/api/publications/${id}`)}>
          <X className="h-4 w-4" /> Cancelar
        </button>
      )}
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="btn-ghost">
          <ExternalLink className="h-4 w-4" /> Ver
        </a>
      )}
      {videoId && (status === "FAILED" || status === "PUBLISHED") && (
        <Link href={`/export/${videoId}?target=${id}`} className="btn-ghost">Exportar</Link>
      )}
      {error && <span role="alert" className="text-xs text-err">{error}</span>}
    </div>
  );
}
