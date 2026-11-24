"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
      {done ? "Copiado" : label}
    </button>
  );
}
