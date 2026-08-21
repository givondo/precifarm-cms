"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import PaymentModeBadge from "@/components/PaymentModeBadge";

type NavItem = { href: string; label: string; hint?: string };

type NavSection = { title: string; items: NavItem[] };

function buildNavSections(role: string): NavSection[] {
  return [
    {
      title: "Overview",
      items: [{ href: "/dashboard", label: "Dashboard" }],
    },
    {
      title: "EV charging",
      items: [
        { href: "/installs", label: "Home installs", hint: "Pulse · Pod · Spark pipeline" },
        {
          href: "/charging-sessions",
          label: "Charging sessions",
          hint: "Corridor DC · Depot · Boda Hub",
        },
        { href: "/customers", label: "Customers", hint: "Phone and reference lookup" },
      ],
    },
    {
      title: "Finance",
      items: [
        { href: "/cash-session", label: "Cash session" },
        { href: "/reconciliation", label: "M-Pesa reconciliation", hint: "Deposits & sessions" },
        ...(role === "admin"
          ? [
              { href: "/analytics", label: "Analytics", hint: "Funnels & acquisition" },
              { href: "/seo", label: "SEO / AISO", hint: "Guides & locations" },
            ]
          : []),
      ],
    },
    {
      title: "Legacy companion",
      items: [
        { href: "/quick-book", label: "Bus tickets", hint: "Nairobi–Kisumu (companion)" },
        { href: "/bookings", label: "Legacy bookings" },
        { href: "/cargo-book", label: "Cargo", hint: "Waybills (legacy)" },
      ],
    },
  ];
}

export default function Sidebar({
  agent,
}: {
  agent: { name: string; role: string; branch?: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const navSections = buildNavSections(agent.role);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-gray-200">
        <div className="text-lg font-bold text-gray-900">Precifarm</div>
        <div className="text-xs text-gray-500 mt-0.5">EV Charging & Payments CMS</div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navSections.map((section, sectionIndex) => (
          <div key={section.title} className={sectionIndex > 0 ? "mt-5" : ""}>
            <div className="nav-section-title">{section.title}</div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-3 py-2 rounded-md transition-colors ${
                      active
                        ? "bg-green-50 text-green-800"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.hint && (
                      <span
                        className={`block text-[11px] mt-0.5 ${
                          active ? "text-green-700/70" : "text-gray-400"
                        }`}
                      >
                        {item.hint}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gray-200 space-y-3">
        <PaymentModeBadge />
        <div>
          <div className="text-sm font-medium text-gray-900">{agent.name}</div>
          <div className="text-xs text-gray-500">
            {agent.role} · {agent.branch ?? "Nairobi"}
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
