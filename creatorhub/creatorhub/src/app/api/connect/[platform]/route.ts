import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { adapters, slugToPlatform } from "@/lib/platforms";
import { appUrl, redirectUriFor } from "@/lib/http";
import { apiUser } from "@/lib/session";

// Paso 1 de OAuth: enviamos a la persona a la pantalla de autorización OFICIAL de la plataforma.
export async function GET(_: Request, { params }: { params: { platform: string } }) {
  const to = (path: string) => NextResponse.redirect(new URL(path, appUrl()));
  const user = await apiUser();
  if (!user) return to("/login");
  const platform = slugToPlatform(params.platform);
  if (!platform) return to("/accounts?error=Plataforma+desconocida");
  const adapter = adapters[platform];
  if (!adapter.isConfigured()) return to(`/accounts?error=${encodeURIComponent("Faltan las credenciales de la API en el archivo .env.")}`);

  const state = randomBytes(24).toString("hex");
  const res = NextResponse.redirect(adapter.authUrl(state, redirectUriFor(params.platform.toLowerCase())));
  res.cookies.set("oauth_state", state, { httpOnly: true, sameSite: "lax", secure: appUrl().startsWith("https://"), path: "/", maxAge: 600 });
  return res;
}
