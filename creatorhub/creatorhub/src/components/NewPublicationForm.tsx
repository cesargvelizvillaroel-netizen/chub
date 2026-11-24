"use client";
import { CalendarClock, Film, Loader2, UploadCloud, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { compose, normalizeTag, PLATFORM_IDS, PLATFORMS, validateDraft, type PlatformId } from "@/lib/platforms/meta";
import { formatDuration, formatSize, PlatformIcon, Thumb } from "./ui";

export type VideoInfo = { id: string; filename: string; size: number; durationSec: number; hasThumb: boolean };
type Override = Partial<{ title: string; description: string; hashtags: string[] }>;

const DEFAULT_SETTINGS: Record<PlatformId, Record<string, any>> = {
  YOUTUBE: { privacy: "public", madeForKids: false },
  TIKTOK: { mode: "direct", privacy: "PUBLIC_TO_EVERYONE", disableComment: false, coverSec: 0 },
  INSTAGRAM: { shareToFeed: true, coverSec: 0 },
};

/** Lee la duración y captura un fotograma como miniatura, todo en el navegador. */
function probe(file: File): Promise<{ duration: number; thumb: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    const done = (duration: number, thumb: Blob | null) => { URL.revokeObjectURL(url); resolve({ duration: Number.isFinite(duration) ? duration : 0, thumb }); };
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 0) / 2); };
    v.onseeked = () => {
      const w = Math.min(480, v.videoWidth || 480);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = Math.round((w * (v.videoHeight || 854)) / (v.videoWidth || 480));
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((b) => done(v.duration, b), "image/jpeg", 0.8);
    };
    v.onerror = () => done(0, null);
  });
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = normalizeTag(text);
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setText("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-raised p-2 focus-within:border-accent">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs text-accent">
          #{t}
          <button type="button" aria-label={`Quitar ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (["Enter", ",", " "].includes(e.key)) { e.preventDefault(); add(); } else if (e.key === "Backspace" && !text && tags.length) onChange(tags.slice(0, -1)); }}
        onBlur={add}
        placeholder={tags.length ? "" : "Escribe un hashtag y pulsa Enter"}
        aria-label="Añadir hashtag"
        className="min-w-32 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted"
      />
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-bg">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function NewPublicationForm({ connected, library, initialVideo }: { connected: PlatformId[]; library: VideoInfo[]; initialVideo: VideoInfo | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<VideoInfo | null>(initialVideo);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialVideo ? `/api/media/${initialVideo.id}` : null);
  const [upload, setUpload] = useState({ pct: 0, busy: false });
  const [dragging, setDragging] = useState(false);

  const [title, setTitle] = useState(initialVideo ? initialVideo.filename.replace(/\.[^.]+$/, "") : "");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<PlatformId[]>([]);
  const [active, setActive] = useState<PlatformId | null>(null);
  const [overrides, setOverrides] = useState<Partial<Record<PlatformId, Override>>>({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [schedule, setSchedule] = useState(false);
  const [when, setWhen] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const eff = (p: PlatformId) => ({
    title: overrides[p]?.title ?? title,
    description: overrides[p]?.description ?? description,
    hashtags: overrides[p]?.hashtags ?? tags,
  });
  const setOv = (p: PlatformId, patch: Override) => setOverrides((o) => ({ ...o, [p]: { ...o[p], ...patch } }));
  const setCfg = (p: PlatformId, key: string, value: unknown) => setSettings((s) => ({ ...s, [p]: { ...s[p], [key]: value } }));

  const errors = selected.flatMap((p) => validateDraft(p, eff(p), video?.durationSec ?? 0).map((m) => `${PLATFORMS[p].label}: ${m}`));
  const whenOk = !schedule || (!!when && new Date(when).getTime() > Date.now());
  const canSubmit = !!video && selected.length > 0 && errors.length === 0 && whenOk && !upload.busy && !submitting;

  function togglePlatform(p: PlatformId) {
    const next = selected.includes(p) ? selected.filter((x) => x !== p) : [...selected, p];
    setSelected(next);
    setActive(next.includes(active as PlatformId) ? active : next[0] ?? null);
  }

  function chooseFromLibrary(v: VideoInfo) {
    setVideo(v);
    setPreviewUrl(`/api/media/${v.id}`);
    if (!title) setTitle(v.filename.replace(/\.[^.]+$/, ""));
  }

  async function handleFile(file?: File) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("video/")) return setError("Selecciona un archivo de video (MP4, MOV o WebM).");
    setUpload({ pct: 0, busy: true });
    const { duration, thumb } = await probe(file);
    const local = URL.createObjectURL(file);
    setPreviewUrl(local);
    try {
      const info = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `/api/upload?name=${encodeURIComponent(file.name)}&duration=${duration}`);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => e.lengthComputable && setUpload({ pct: Math.round((e.loaded / e.total) * 100), busy: true });
        xhr.onload = () => {
          try {
            const j = JSON.parse(xhr.responseText);
            xhr.status < 300 ? resolve(j) : reject(new Error(j.error ?? "No se pudo subir el video."));
          } catch { reject(new Error("Respuesta no válida del servidor.")); }
        };
        xhr.onerror = () => reject(new Error("Se perdió la conexión durante la subida."));
        xhr.send(file);
      });
      if (thumb) await fetch(`/api/videos/${info.id}/thumbnail`, { method: "POST", body: thumb });
      setVideo({ id: info.id, filename: info.filename, size: info.size, durationSec: info.durationSec, hasThumb: !!thumb });
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError((e as Error).message);
      setPreviewUrl(null);
      URL.revokeObjectURL(local);
    }
    setUpload({ pct: 0, busy: false });
  }

  async function submit() {
    if (!video) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/publications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: video.id,
        scheduledAt: schedule ? new Date(when).toISOString() : null,
        targets: selected.map((p) => ({ platform: p, ...eff(p), settings: settings[p] })),
      }),
    });
    if (res.ok) return router.push(schedule ? "/calendar" : "/history");
    setError((await res.json().catch(() => ({}))).error ?? "No se pudo crear la publicación.");
    setSubmitting(false);
  }

  const cover = (p: PlatformId) =>
    PLATFORMS[p].coverSupport && video ? (
      <div>
        <label className="label" htmlFor={`cover-${p}`}>Portada: fotograma en el segundo {Number(settings[p].coverSec).toFixed(1)}</label>
        <input id={`cover-${p}`} type="range" min={0} max={Math.max(0.1, Math.floor(video.durationSec * 10) / 10)} step={0.1} value={settings[p].coverSec} onChange={(e) => setCfg(p, "coverSec", Number(e.target.value))} className="w-full accent-[rgb(var(--accent))]" />
      </div>
    ) : !PLATFORMS[p].coverSupport ? (
      <p className="hint">YouTube Shorts no permite elegir portada desde la API; YouTube usa un fotograma del video.</p>
    ) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Step n={1} title="Video">
          {video && previewUrl ? (
            <div className="flex flex-col gap-4 sm:flex-row">
              <video src={previewUrl} controls playsInline preload="metadata" className="aspect-[9/16] max-h-80 rounded-lg bg-black" />
              <div className="space-y-2 text-sm">
                <p className="font-medium break-all">{video.filename}</p>
                <p className="text-muted">Tamaño: {formatSize(video.size)}</p>
                <p className="text-muted">Duración: {formatDuration(video.durationSec)}</p>
                <button className="btn-ghost" onClick={() => { setVideo(null); setPreviewUrl(null); }}>Cambiar video</button>
              </div>
            </div>
          ) : (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? "border-accent bg-accent/5" : "border-line"}`}
              >
                {upload.busy ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <p className="text-sm">Subiendo… {upload.pct}%</p>
                    <div className="h-1.5 w-56 overflow-hidden rounded-full bg-raised"><div className="h-full bg-accent transition-all" style={{ width: `${upload.pct}%` }} /></div>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-8 w-8 text-muted" />
                    <p className="text-sm">Arrastra tu video aquí o</p>
                    <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>Elegir desde el dispositivo</button>
                    <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
                  </>
                )}
              </div>
              {library.length > 0 && !upload.busy && (
                <div className="mt-4">
                  <p className="mb-2 flex items-center gap-1.5 text-sm text-muted"><Film className="h-4 w-4" /> O reutiliza uno de tu biblioteca</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {library.map((v) => (
                      <button key={v.id} type="button" onClick={() => chooseFromLibrary(v)} className="w-20 shrink-0 text-left" title={v.filename}>
                        <Thumb videoId={v.id} hasThumb={v.hasThumb} className="aspect-[9/14] w-full rounded-md" />
                        <span className="mt-1 block truncate text-xs text-muted">{v.filename}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Step>

        <Step n={2} title="Texto">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="title">Título</label>
              <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Qué verá la gente primero" />
            </div>
            <div>
              <label className="label" htmlFor="desc">Descripción</label>
              <textarea id="desc" className="input min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <label className="label">Hashtags</label>
              <TagInput tags={tags} onChange={setTags} />
            </div>
          </div>
        </Step>

        <Step n={3} title="Plataformas">
          <div className="grid gap-3 sm:grid-cols-3">
            {PLATFORM_IDS.map((p) => {
              const ok = connected.includes(p);
              const on = selected.includes(p);
              return ok ? (
                <button key={p} type="button" aria-pressed={on} onClick={() => togglePlatform(p)} className={`rounded-xl border p-4 text-left transition-colors ${on ? "border-accent bg-accent/10" : "border-line hover:bg-raised"}`}>
                  <PlatformIcon p={p} className="h-5 w-5" />
                  <p className="mt-2 text-sm font-medium">{PLATFORMS[p].label}</p>
                  <p className="text-xs text-muted">{on ? "Seleccionada" : "Toca para incluir"}</p>
                </button>
              ) : (
                <Link key={p} href="/accounts" className="rounded-xl border border-dashed border-line p-4 opacity-70 hover:opacity-100">
                  <PlatformIcon p={p} className="h-5 w-5" />
                  <p className="mt-2 text-sm font-medium">{PLATFORMS[p].label}</p>
                  <p className="text-xs text-accent">Conectar cuenta</p>
                </Link>
              );
            })}
          </div>
        </Step>

        {active && (
          <Step n={4} title="Ajustes por plataforma">
            <div role="tablist" className="mb-4 flex gap-1 border-b border-line">
              {selected.map((p) => (
                <button key={p} role="tab" aria-selected={p === active} onClick={() => setActive(p)} className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${p === active ? "border-accent" : "border-transparent text-muted"}`}>
                  <PlatformIcon p={p} /> {PLATFORMS[p].label}
                </button>
              ))}
            </div>
            {(() => {
              const p = active;
              const e = eff(p);
              const { body } = compose(p, e);
              return (
                <div className="space-y-4">
                  <div>
                    <label className="label" htmlFor="p-title">Título <span className="hint">({e.title.length}/{PLATFORMS[p].titleMax})</span></label>
                    <input id="p-title" className="input" value={e.title} onChange={(ev) => setOv(p, { title: ev.target.value })} />
                  </div>
                  <div>
                    <label className="label" htmlFor="p-desc">Descripción <span className="hint">(texto final: {body.length}/{PLATFORMS[p].captionMax})</span></label>
                    <textarea id="p-desc" className="input min-h-20" value={e.description} onChange={(ev) => setOv(p, { description: ev.target.value })} />
                  </div>
                  <div>
                    <label className="label">Hashtags <span className="hint">({e.hashtags.length}/{PLATFORMS[p].maxHashtags})</span></label>
                    <TagInput tags={e.hashtags} onChange={(t) => setOv(p, { hashtags: t })} />
                  </div>
                  {p === "YOUTUBE" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor="yt-priv">Visibilidad</label>
                        <select id="yt-priv" className="input" value={settings.YOUTUBE.privacy} onChange={(ev) => setCfg("YOUTUBE", "privacy", ev.target.value)}>
                          <option value="public">Público</option><option value="unlisted">No listado</option><option value="private">Privado</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 self-end pb-2 text-sm">
                        <input type="checkbox" checked={settings.YOUTUBE.madeForKids} onChange={(ev) => setCfg("YOUTUBE", "madeForKids", ev.target.checked)} /> Contenido hecho para niños
                      </label>
                    </div>
                  )}
                  {p === "TIKTOK" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor="tt-mode">Cómo enviarlo</label>
                        <select id="tt-mode" className="input" value={settings.TIKTOK.mode} onChange={(ev) => setCfg("TIKTOK", "mode", ev.target.value)}>
                          <option value="direct">Publicar directamente</option><option value="draft">Enviar a borradores de TikTok</option>
                        </select>
                      </div>
                      {settings.TIKTOK.mode === "direct" && (
                        <div>
                          <label className="label" htmlFor="tt-priv">Quién puede verlo</label>
                          <select id="tt-priv" className="input" value={settings.TIKTOK.privacy} onChange={(ev) => setCfg("TIKTOK", "privacy", ev.target.value)}>
                            <option value="PUBLIC_TO_EVERYONE">Todos</option><option value="MUTUAL_FOLLOW_FRIENDS">Amigos</option><option value="FOLLOWER_OF_CREATOR">Seguidores</option><option value="SELF_ONLY">Solo yo</option>
                          </select>
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={settings.TIKTOK.disableComment} onChange={(ev) => setCfg("TIKTOK", "disableComment", ev.target.checked)} /> Desactivar comentarios
                      </label>
                    </div>
                  )}
                  {p === "INSTAGRAM" && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={settings.INSTAGRAM.shareToFeed} onChange={(ev) => setCfg("INSTAGRAM", "shareToFeed", ev.target.checked)} /> Mostrar también en el feed del perfil
                    </label>
                  )}
                  {cover(p)}
                  {overrides[p] && (
                    <button className="btn-ghost" onClick={() => setOverrides((o) => ({ ...o, [p]: undefined }))}>Restablecer al texto general</button>
                  )}
                </div>
              );
            })()}
          </Step>
        )}

        <Step n={5} title="Cuándo publicar">
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={!schedule} onClick={() => setSchedule(false)} className={`btn ${!schedule ? "bg-accent text-bg" : "border border-line"}`}>Ahora</button>
            <button type="button" aria-pressed={schedule} onClick={() => setSchedule(true)} className={`btn ${schedule ? "bg-accent text-bg" : "border border-line"}`}><CalendarClock className="h-4 w-4" /> Programar</button>
          </div>
          {schedule && (
            <div className="mt-4 max-w-xs">
              <label className="label" htmlFor="when">Fecha y hora</label>
              <input id="when" type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
              {when && !whenOk && <p role="alert" className="mt-1 text-xs text-err">Elige una fecha futura.</p>}
              <p className="hint mt-1">La publicación sale a la hora elegida mientras el worker esté en ejecución.</p>
            </div>
          )}
        </Step>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="card p-4">
          <h2 className="mb-3 text-lg font-semibold">Vista previa</h2>
          {selected.length === 0 || !previewUrl ? (
            <p className="py-6 text-center text-sm text-muted">Elige un video y al menos una plataforma para ver cómo quedará.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {selected.map((p) => {
                const c = compose(p, eff(p));
                return (
                  <div key={p}>
                    <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-line bg-black">
                      <video src={previewUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-8 text-[10px] leading-snug text-white">
                        {c.title && <p className="line-clamp-2 font-semibold">{c.title}</p>}
                        <p className="line-clamp-3 opacity-90">{c.body}</p>
                      </div>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted"><PlatformIcon p={p} className="h-3 w-3" /> {PLATFORMS[p].label}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {errors.length > 0 && (
          <ul role="alert" className="space-y-1 rounded-lg bg-err/10 p-3 text-sm text-err">{errors.map((m) => <li key={m}>{m}</li>)}</ul>
        )}
        {error && <p role="alert" className="rounded-lg bg-err/10 p-3 text-sm text-err">{error}</p>}
        <button className="btn-primary w-full py-3" disabled={!canSubmit} onClick={submit}>
          {submitting ? "Enviando…" : schedule ? "Programar publicación" : "Publicar ahora"}
        </button>
        <p className="hint text-center">Después podrás ver el estado real de cada plataforma en el Historial.</p>
      </aside>
    </div>
  );
}
