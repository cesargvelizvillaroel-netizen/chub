import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { appUrl, redirectUriFor } from "@/lib/http";
import { adapters, slugToPlatform } from "@/lib/platforms";
import { PLATFORMS } from "@/lib/platforms/meta";
import { apiUser } from "@/lib/session";

// Paso 2 de OAuth: la plataforma nos devuelve un código; lo cambiamos por tokens (nunca vemos tu contraseña).
export async function GET(req: Request, { params }: { params: { platform: string } }) {
  const to = (path: string) => {
    const r = NextResponse.redirect(new URL(path, appUrl()));
    r.cookies.delete("oauth_state");
    return r;
  };
  const fail = (m: string) => to(`/accounts?error=${encodeURIComponent(m)}`);

  const user = await apiUser();
  if (!user) return to("/login");
  const platform = slugToPlatform(params.platform);
  if (!platform) return fail("Plataforma desconocida.");

  const url = new URL(req.url);
  const cookieState = req.headers.get("cookie")?.match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1];
  if (url.searchParams.get("error")) return fail("Cancelaste la autorización o la plataforma la rechazó.");
  if (!cookieState || cookieState !== url.searchParams.get("state")) return fail("La verificación de seguridad falló. Intenta conectar de nuevo.");
  const code = url.searchParams.get("code");
  if (!code) return fail("La plataforma no devolvió el código de autorización.");

  try {
    const t = await adapters[platform].exchangeCode(code, redirectUriFor(params.platform.toLowerCase()));
    const data = {
      externalId: t.externalId,
      displayName: t.displayName,
      accessTokenEnc: encrypt(t.accessToken),
      refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken) : null,
      expiresAt: t.expiresAt ?? null,
    };
    await prisma.socialAccount.upsert({
      where: { userId_platform: { userId: user.id, platform } },
      create: { userId: user.id, platform, ...data },
      update: data,
    });
    return to(`/accounts?connected=${encodeURIComponent(PLATFORMS[platform].label)}`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "No se pudo conectar la cuenta.");
  }
}
