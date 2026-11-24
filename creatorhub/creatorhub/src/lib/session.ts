import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";

export const SESSION_COOKIE = "ch_session";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres (revisa tu .env).");
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function destroySession() {
  cookies().delete(SESSION_COOKIE);
}

export async function getUserId(): Promise<string | null> {
  const t = cookies().get(SESSION_COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, secret());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** Para páginas: redirige a /login si no hay sesión. */
export async function requireUser() {
  const id = await getUserId();
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null;
  if (!user) redirect("/login");
  return user;
}

/** Para rutas API: devuelve el usuario o null. */
export async function apiUser() {
  const id = await getUserId();
  return id ? prisma.user.findUnique({ where: { id } }) : null;
}
