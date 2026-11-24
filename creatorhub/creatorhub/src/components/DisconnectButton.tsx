"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DisconnectButton({ slug, label }: { slug: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-danger"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`¿Desconectar ${label}? Las publicaciones pendientes en esa plataforma fallarán.`)) return;
        setBusy(true);
        await fetch(`/api/accounts/${slug}`, { method: "DELETE" });
        router.refresh();
        setBusy(false);
      }}
    >
      Desconectar
    </button>
  );
}
