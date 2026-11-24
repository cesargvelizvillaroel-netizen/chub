"use client";
import { useEffect, useState } from "react";

/** Muestra una fecha en la zona horaria del navegador (evita desfases entre servidor y cliente). */
export function LocalDate({ iso, withTime = true }: { iso: string | null | undefined; withTime?: boolean }) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!iso) return setText("—");
    const d = new Date(iso);
    setText(d.toLocaleString("es", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }));
  }, [iso, withTime]);
  return <span suppressHydrationWarning>{text}</span>;
}
