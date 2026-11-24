import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { bad } from "@/lib/http";
import { createSession } from "@/lib/session";

const schema = z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(200) });

export async function POST(req: Request) {
  if (process.env.ALLOW_REGISTRATION === "false") return bad("El registro está desactivado.", 403);
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("Revisa los datos: la contraseña debe tener al menos 8 caracteres.");
  if (await prisma.user.findUnique({ where: { email: p.data.email } })) return bad("Ese correo ya está registrado.", 409);
  const user = await prisma.user.create({
    data: { name: p.data.name, email: p.data.email, passwordHash: await bcrypt.hash(p.data.password, 12) },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
