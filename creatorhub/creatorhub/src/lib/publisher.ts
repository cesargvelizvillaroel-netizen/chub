import { decrypt, encrypt, makeMediaToken } from "./crypto";
import { prisma } from "./db";
import { filePath } from "./storage";
import { adapters } from "./platforms";
import { PLATFORMS } from "./platforms/meta";
import { PlatformAdapter, PlatformError } from "./platforms/types";
import type { SocialAccount } from "@prisma/client";

export const MAX_ATTEMPTS = 3;

async function freshToken(acc: SocialAccount, adapter: PlatformAdapter): Promise<string> {
  let access = decrypt(acc.accessTokenEnc);
  if (acc.expiresAt && acc.expiresAt.getTime() - Date.now() < 5 * 60_000) {
    const r = await adapter.refresh({ accessToken: access, refreshToken: acc.refreshTokenEnc ? decrypt(acc.refreshTokenEnc) : undefined });
    await prisma.socialAccount.update({
      where: { id: acc.id },
      data: {
        accessTokenEnc: encrypt(r.accessToken),
        refreshTokenEnc: r.refreshToken ? encrypt(r.refreshToken) : acc.refreshTokenEnc,
        expiresAt: r.expiresAt ?? null,
      },
    });
    access = r.accessToken;
  }
  return access;
}

/** Publica un destino ya "reclamado" por el worker (status PUBLISHING). Siempre deja un estado final o de reintento. */
export async function processTarget(id: string) {
  const t = await prisma.postTarget.findUnique({ where: { id }, include: { post: { include: { video: true } } } });
  if (!t) return;
  try {
    const video = t.post.video;
    if (!video) throw new PlatformError("El video ya no existe en la biblioteca.");
    const account = await prisma.socialAccount.findUnique({
      where: { userId_platform: { userId: t.post.userId, platform: t.platform } },
    });
    if (!account) throw new PlatformError(`La cuenta de ${PLATFORMS[t.platform].label} no está conectada.`);
    const adapter = adapters[t.platform];
    const accessToken = await freshToken(account, adapter);

    const result = await adapter.publish({
      accessToken,
      externalAccountId: account.externalId,
      videoPath: filePath(video.storageKey),
      mimeType: video.mimeType,
      size: video.size,
      durationSec: video.durationSec,
      title: t.title,
      description: t.description,
      hashtags: t.hashtags,
      settings: (t.settings ?? {}) as Record<string, any>,
      mediaToken: makeMediaToken(video.id),
    });

    await prisma.postTarget.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        externalId: result.externalId,
        externalUrl: result.url ?? null,
        note: result.note ?? null,
        errorMessage: null,
        lockedAt: null,
      },
    });
  } catch (e) {
    const err = e instanceof PlatformError ? e : new PlatformError(e instanceof Error ? e.message : String(e), false);
    const retry = err.retryable && t.attempts < MAX_ATTEMPTS;
    await prisma.postTarget.update({
      where: { id },
      data: retry
        ? {
            status: "PENDING",
            nextAttemptAt: new Date(Date.now() + 2 ** t.attempts * 60_000),
            errorMessage: `Intento ${t.attempts} de ${MAX_ATTEMPTS} fallido: ${err.message}. Se reintentará automáticamente.`,
            lockedAt: null,
          }
        : { status: "FAILED", errorMessage: err.message, lockedAt: null },
    });
  }
}
