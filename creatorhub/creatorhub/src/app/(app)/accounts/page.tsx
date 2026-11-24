import { CheckCircle2, TriangleAlert } from "lucide-react";
import { DisconnectButton } from "@/components/DisconnectButton";
import { PageHeader, PlatformIcon } from "@/components/ui";
import { LocalDate } from "@/components/LocalDate";
import { prisma } from "@/lib/db";
import { adapters } from "@/lib/platforms";
import { PLATFORM_IDS, PLATFORMS } from "@/lib/platforms/meta";
import { requireUser } from "@/lib/session";

const NOTES: Record<string, string> = {
  YOUTUBE: "Los proyectos de Google sin verificar pueden dejar los videos como privados hasta que Google audite tu app.",
  TIKTOK: "Publicar directo requiere que TikTok apruebe tu app. Mientras tanto usa el modo borrador: el video llega a tu bandeja y lo publicas desde la app.",
  INSTAGRAM: "Necesita una cuenta profesional (Business o Creator) y que APP_URL sea una dirección pública HTTPS.",
};

export default async function AccountsPage({ searchParams }: { searchParams: { connected?: string; error?: string } }) {
  const user = await requireUser();
  const accounts = await prisma.socialAccount.findMany({ where: { userId: user.id } });

  return (
    <>
      <PageHeader title="Cuentas conectadas" subtitle="Conectas cada cuenta desde la página oficial de la plataforma. CreatorHub nunca ve tu contraseña." />
      {searchParams.connected && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-ok/10 px-4 py-3 text-sm text-ok"><CheckCircle2 className="h-4 w-4" /> {searchParams.connected} conectado correctamente.</p>
      )}
      {searchParams.error && (
        <p role="alert" className="mb-4 flex items-center gap-2 rounded-lg bg-err/10 px-4 py-3 text-sm text-err"><TriangleAlert className="h-4 w-4" /> {searchParams.error}</p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {PLATFORM_IDS.map((p) => {
          const acc = accounts.find((a) => a.platform === p);
          const configured = adapters[p].isConfigured();
          const slug = p.toLowerCase();
          return (
            <section key={p} className="card flex flex-col gap-4 p-5">
              <div className="flex items-center gap-2.5">
                <PlatformIcon p={p} className="h-5 w-5" />
                <h2 className="text-lg font-semibold">{PLATFORMS[p].label}</h2>
              </div>
              {acc ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-ok">Conectada</p>
                  <p className="text-sm">{acc.displayName}</p>
                  <p className="text-xs text-muted">Desde <LocalDate iso={acc.createdAt.toISOString()} withTime={false} /></p>
                </div>
              ) : (
                <p className="text-sm text-muted">{configured ? "Sin conectar." : "Faltan las credenciales de la API en el archivo .env."}</p>
              )}
              <p className="text-xs text-muted">{NOTES[p]}</p>
              <div className="mt-auto flex gap-2">
                {acc ? (
                  <>
                    <a href={`/api/connect/${slug}`} className="btn-ghost flex-1">Reconectar</a>
                    <DisconnectButton slug={slug} label={PLATFORMS[p].label} />
                  </>
                ) : configured ? (
                  <a href={`/api/connect/${slug}`} className="btn-primary w-full">Conectar</a>
                ) : (
                  <button className="btn-ghost w-full" disabled>No disponible</button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-6 max-w-2xl text-sm text-muted">
        Si una plataforma no permite publicar por API o aún no aprobó tu app, usa <strong>Exportar</strong> desde la biblioteca o el historial: descargas el video con su texto listo y lo subes tú mismo.
      </p>
    </>
  );
}
