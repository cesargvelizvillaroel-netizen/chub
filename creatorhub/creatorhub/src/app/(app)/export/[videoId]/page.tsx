import { Download, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { PageHeader, PlatformIcon, formatDuration, formatSize } from "@/components/ui";
import { prisma } from "@/lib/db";
import { compose, PLATFORM_IDS, PLATFORMS } from "@/lib/platforms/meta";
import { requireUser } from "@/lib/session";

// Alternativa manual: descarga el video y copia el texto para publicarlo tú en la plataforma.
export default async function ExportPage({ params, searchParams }: { params: { videoId: string }; searchParams: { target?: string } }) {
  const user = await requireUser();
  const video = await prisma.video.findFirst({ where: { id: params.videoId, userId: user.id } });
  if (!video) notFound();
  const target = searchParams.target
    ? await prisma.postTarget.findFirst({ where: { id: searchParams.target, post: { userId: user.id, videoId: video.id } } })
    : null;

  return (
    <>
      <PageHeader title="Exportar para publicar manualmente" subtitle={`${video.filename} · ${formatSize(video.size)} · ${formatDuration(video.durationSec)}`} />
      <div className="card mb-6 flex flex-wrap items-center gap-4 p-5">
        <a href={`/api/media/${video.id}?download=1`} className="btn-primary"><Download className="h-4 w-4" /> Descargar video</a>
        <p className="text-sm text-muted">Descarga el archivo original y súbelo en la app o web de cada plataforma.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLATFORM_IDS.map((p) => {
          const draft = target?.platform === p ? { title: target.title, description: target.description, hashtags: target.hashtags } : null;
          const text = draft ? (() => { const c = compose(p, draft); return p === "YOUTUBE" ? `${c.title}\n\n${c.body}` : c.body; })() : "";
          return (
            <section key={p} className="card flex flex-col gap-3 p-5">
              <h2 className="flex items-center gap-2 font-semibold"><PlatformIcon p={p} className="h-5 w-5" /> {PLATFORMS[p].label}</h2>
              {text ? (
                <>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-raised p-3 font-sans text-sm">{text}</pre>
                  <CopyButton text={text} label="Copiar texto" />
                </>
              ) : (
                <p className="text-sm text-muted">Sin texto guardado para esta plataforma.</p>
              )}
              <a href={PLATFORMS[p].manualUrl} target="_blank" rel="noreferrer" className="btn-ghost mt-auto"><ExternalLink className="h-4 w-4" /> Abrir {PLATFORMS[p].label}</a>
            </section>
          );
        })}
      </div>
    </>
  );
}
