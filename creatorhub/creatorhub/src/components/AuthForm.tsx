"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const register = mode === "register";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return router.replace("/dashboard");
    setError((await res.json().catch(() => ({}))).error ?? "No se pudo continuar.");
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-7">
        <div className="mb-2">
          <p className="flex items-center gap-2 font-display text-xl font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_rgb(var(--accent))]" aria-hidden /> CreatorHub
          </p>
          <p className="mt-1 text-sm text-muted">{register ? "Crea tu cuenta para empezar a publicar." : "Entra para publicar tus videos."}</p>
        </div>
        {register && (
          <div>
            <label className="label" htmlFor="name">Nombre</label>
            <input id="name" name="name" required className="input" autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" required minLength={register ? 8 : 1} className="input" autoComplete={register ? "new-password" : "current-password"} />
          {register && <p className="hint mt-1">Mínimo 8 caracteres.</p>}
        </div>
        {error && <p role="alert" className="text-sm text-err">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Un momento…" : register ? "Crear cuenta" : "Entrar"}</button>
        <p className="text-center text-sm text-muted">
          {register ? "¿Ya tienes cuenta? " : "¿Primera vez? "}
          <Link href={register ? "/login" : "/register"} className="text-accent hover:underline">{register ? "Entrar" : "Crear cuenta"}</Link>
        </p>
      </form>
    </main>
  );
}
