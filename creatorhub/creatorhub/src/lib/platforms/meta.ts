// Datos de las plataformas SIN dependencias de Node: se usan en el navegador y en el servidor.
export type PlatformId = "YOUTUBE" | "TIKTOK" | "INSTAGRAM";
export const PLATFORM_IDS: PlatformId[] = ["YOUTUBE", "TIKTOK", "INSTAGRAM"];

export const PLATFORMS: Record<
  PlatformId,
  { label: string; titleMax: number; captionMax: number; maxHashtags: number; maxDurationSec: number; coverSupport: boolean; manualUrl: string }
> = {
  YOUTUBE: { label: "YouTube Shorts", titleMax: 100, captionMax: 5000, maxHashtags: 15, maxDurationSec: 180, coverSupport: false, manualUrl: "https://studio.youtube.com" },
  TIKTOK: { label: "TikTok", titleMax: 2200, captionMax: 2200, maxHashtags: 30, maxDurationSec: 600, coverSupport: true, manualUrl: "https://www.tiktok.com/upload" },
  INSTAGRAM: { label: "Instagram Reels", titleMax: 2200, captionMax: 2200, maxHashtags: 30, maxDurationSec: 900, coverSupport: true, manualUrl: "https://www.instagram.com" },
};

export function normalizeTag(t: string): string {
  return t.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
}

export type Draft = { title: string; description: string; hashtags: string[] };

/** Texto final que recibirá cada plataforma. YouTube separa título y descripción; las otras usan un solo texto. */
export function compose(p: PlatformId, d: Draft): { title: string; body: string } {
  const tags = d.hashtags.map((t) => "#" + t).join(" ");
  if (p === "YOUTUBE") {
    const parts = [d.description.trim(), tags];
    if (!/#shorts\b/i.test(tags + d.description)) parts.push("#Shorts");
    return { title: d.title.trim(), body: parts.filter(Boolean).join("\n\n") };
  }
  const sep = p === "TIKTOK" ? "\n" : "\n\n";
  return { title: "", body: [d.title.trim(), d.description.trim(), tags].filter(Boolean).join(sep) };
}

export function validateDraft(p: PlatformId, d: Draft, durationSec: number): string[] {
  const m = PLATFORMS[p];
  const errs: string[] = [];
  const { title, body } = compose(p, d);
  if (!d.title.trim()) errs.push("Escribe un título.");
  if (p === "YOUTUBE" && title.length > m.titleMax) errs.push(`El título supera ${m.titleMax} caracteres.`);
  if (body.length > m.captionMax) errs.push(`El texto supera ${m.captionMax} caracteres.`);
  if (d.hashtags.length > m.maxHashtags) errs.push(`Máximo ${m.maxHashtags} hashtags.`);
  if (durationSec > m.maxDurationSec) errs.push(`El video dura más de ${m.maxDurationSec}s, el máximo de referencia.`);
  return errs;
}

export const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Publicado correctamente",
  PENDING: "Pendiente",
  SCHEDULED: "Programado",
  PUBLISHING: "Publicando",
  FAILED: "Error de publicación",
  CANCELED: "Cancelada",
};
