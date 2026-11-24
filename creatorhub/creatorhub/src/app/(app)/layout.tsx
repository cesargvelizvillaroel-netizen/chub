import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <Sidebar userName={user.name} />
      <main className="mx-auto max-w-6xl p-4 sm:p-6 md:ml-64 md:p-8 animate-rise">{children}</main>
    </div>
  );
}
