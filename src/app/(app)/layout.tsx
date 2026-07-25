import { redirect } from "next/navigation";
import { getSessionAgent } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

/** Agent desk pages use cookies + DB — must not prerender at build time on Netlify. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const agent = await getSessionAgent();
  if (!agent) redirect("/login");

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar agent={agent} />
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
