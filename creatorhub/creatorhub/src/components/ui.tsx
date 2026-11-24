import { Instagram, Music2, Youtube } from "lucide-react";
import { PLATFORMS, STATUS_LABEL, type PlatformId } from "@/lib/platforms/meta";

export const PLATFORM_COLOR: Record<PlatformId, string> = { YOUTUBE: "#FF4B4B", TIKTOK: "#2DD4D4", INSTAGRAM: "#E1306C" };

export function PlatformIcon({ p, className = "h-4 w-4" }: { p: PlatformId; className?: string }) {
  const Icon = p === "YOUTUBE" ? Youtube : p === "INSTAGRAM" ? Instagram : Music2;
  return <Icon className={className} style={{ color: PLATFORM_COLOR[p] }} aria-hidden />;
}

export function PlatformLabel({ p }: { p: PlatformId }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <PlatformIcon p={p} />
      {PLATFORMS[p].label}
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: "bg-ok/15 text-ok",
  PENDING: "bg-warn/15 text-warn",
  SCHEDULED: "bg-sched/15 text-sched",
  PUBLISHING: "bg-info/15 text-info",
  FAILED: "bg-err/15 text-err",
  CANCELED: "bg-raised text-muted",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status] ?? ""}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${status === "PUBLISHING" ? "animate-pulse" : ""}`} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function formatDuration(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="font-display text-lg">{title}</p>
      {children}
    </div>
  );
}

export function Thumb({ videoId, hasThumb, className = "" }: { videoId: string | null; hasThumb: boolean; className?: string }) {
  return videoId && hasThumb ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/media/${videoId}?thumb=1`} alt="" className={`bg-raised object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-raised text-xs text-muted ${className}`}>Sin vista</div>
  );
}
