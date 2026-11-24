import { instagram } from "./instagram";
import { tiktok } from "./tiktok";
import type { PlatformAdapter } from "./types";
import type { PlatformId } from "./meta";
import { youtube } from "./youtube";

export const adapters: Record<PlatformId, PlatformAdapter> = {
  YOUTUBE: youtube,
  TIKTOK: tiktok,
  INSTAGRAM: instagram,
};

export const slugToPlatform = (slug: string): PlatformId | null => {
  const p = slug.toUpperCase();
  return p === "YOUTUBE" || p === "TIKTOK" || p === "INSTAGRAM" ? (p as PlatformId) : null;
};
