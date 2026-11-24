import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad } from "@/lib/http";
import { createSession } from "@/lib/session";

// Límite sencillo en memoria: 5 intentos fallidos por correo cada 15 minutos.
const fails = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const f = fails.get(email);
  if (f && f.n >= 5 && f.until > Date.now()) return bad("Demasiados intentos. Espera unos minutos.", 429);

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const n = (f && f.until > Date.now() ? f.n : 0) + 1;
    fails.set(email, { n, until: Date.now() + 15 * 60_000 });
    return bad("Correo o contraseña incorrectos.", 401);
  }
  fails.delete(email);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
