"use client";
import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocalDate } from "./LocalDate";
import { PlatformLabel, StatusBadge, Thumb } from "./ui";
import type { PlatformId } from "@/lib/platforms/meta";

export type ScheduledData = {
  id: string; platform: PlatformId; title: string; description: string; status: string;
  when: string; videoId: string | null; hasThumb: boolean; videoName: string;
};

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function ScheduledItem({ t }: { t: ScheduledData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [description, setDescription] = useState(t.description);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(method: "PATCH" | "DELETE", body?: object) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/publications/${t.id}`, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else setError((await res.json().catch(() => ({}))).error ?? "No se pudo completar la acción.");
    setBusy(false);
  }

  return (
    <li className="card p-4">
      <div className="flex items-center gap-3">
        <Thumb videoId={t.videoId} hasThumb={t.hasThumb} className="h-14 w-10 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{t.title}</p>
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
            <PlatformLabel p={t.platform} /> <LocalDate iso={t.when} />
          </p>
        </div>
        <StatusBadge status={t.status} />
        <button className="btn-ghost px-2.5" onClick={() => { setEditing(!editing); setWhen(toLocalInput(t.when)); }} aria-label="Modificar">
          <Pencil className="h-4 w-4" />
        </button>
        <button className="btn-danger px-2.5" disabled={busy} aria-label="Cancelar publicación" onClick={() => confirm("¿Cancelar esta publicación?") && run("DELETE")}>
          <X className="h-4 w-4" />
        </button>
      </div>
      {editing && (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <div>
            <label className="label">Fecha y hora</label>
            <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div>
            <label className="label">Título</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Descripción</label>
            <textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-err sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary" disabled={busy || !when} onClick={() => run("PATCH", { title, description, scheduledAt: new Date(when).toISOString() })}>Guardar cambios</button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>Cerrar</button>
          </div>
        </div>
      )}
      {!editing && error && <p role="alert" className="mt-2 text-xs text-err">{error}</p>}
    </li>
  );
}
