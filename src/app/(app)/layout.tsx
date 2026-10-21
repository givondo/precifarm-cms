import { redirect } from "next/navigation";
import { getSessionAgent } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

/** Agent desk pages use cookies + DB — must not prerender at build time on Netlify. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const agent = await getSessionAgent();
  if (!agent) redirect("/login");

  return (
    <div className="pf-shell">
      <Sidebar agent={agent} />
      <main className="pf-main">
        <div className="pf-page">{children}</div>
      </main>
    </div>
  );
}
