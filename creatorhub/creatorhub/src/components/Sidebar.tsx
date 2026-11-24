"use client";
import { CalendarDays, Film, History, LayoutDashboard, Link2, LogOut, Menu, Moon, Sun, UploadCloud, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/new", label: "Nueva publicación", icon: UploadCloud },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/history", label: "Historial", icon: History },
  { href: "/library", label: "Biblioteca", icon: Film },
  { href: "/accounts", label: "Cuentas conectadas", icon: Link2 },
];

export function Sidebar({ userName }: { userName: string }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => setTheme(document.documentElement.dataset.theme ?? "dark"), []);
  useEffect(() => setOpen(false), [path]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const content = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-2.5 font-display text-lg font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_rgb(var(--accent))]" aria-hidden />
          CreatorHub
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? "bg-raised text-ink" : "text-muted hover:bg-raised/60 hover:text-ink"}`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-accent" : ""}`} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line p-3">
        <p className="truncate px-3 pb-2 text-xs text-muted">{userName}</p>
        <div className="flex gap-2">
          <button onClick={toggleTheme} className="btn-ghost flex-1" aria-label="Cambiar tema">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={logout} className="btn-ghost flex-1">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-surface md:block">{content}</aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <span className="flex items-center gap-2 font-display font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden /> CreatorHub
        </span>
        <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="btn-ghost px-2.5">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface">
            <button onClick={() => setOpen(false)} aria-label="Cerrar menú" className="absolute right-3 top-4 text-muted">
              <X className="h-5 w-5" />
            </button>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
