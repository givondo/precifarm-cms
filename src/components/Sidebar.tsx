"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
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
        { href: "/installs", label: "Home installs", hint: "Pulse, Pod and Spark pipeline" },
        { href: "/charging-sessions", label: "Charging sessions", hint: "Corridor DC, Depot, Boda Hub" },
        { href: "/customers", label: "Customers", hint: "Phone and reference lookup" },
      ],
    },
    {
      title: "Finance",
      items: [
        { href: "/cash-session", label: "Cash session" },
        { href: "/reconciliation", label: "M-Pesa reconciliation", hint: "Deposits and sessions" },
        ...(role === "admin"
          ? [
              { href: "/analytics", label: "Analytics", hint: "Funnels and acquisition" },
              { href: "/seo", label: "SEO and AISO", hint: "Guides and locations" },
            ]
          : []),
      ],
    },
    {
      title: "Legacy companion",
      items: [
        { href: "/quick-book", label: "Bus tickets", hint: "Nairobi to Kisumu (companion)" },
        { href: "/bookings", label: "Legacy bookings" },
        { href: "/cargo-book", label: "Cargo", hint: "Waybills (legacy)" },
      ],
    },
  ];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

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
    <aside className="pf-side">
      <div className="pf-brand">
        <div className="pf-mark">
          <BrandMark />
        </div>
        <div>
          <b>Precifarm</b>
          <span>Operations CMS</span>
        </div>
      </div>

      <nav className="pf-nav" aria-label="Main">
        {navSections.map((section) => (
          <div key={section.title} className="pf-nav-group">
            <div className="pf-nav-title">{section.title}</div>
            {section.items.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
                <span className="l">{item.label}</span>
                {item.hint ? <span className="h">{item.hint}</span> : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="pf-foot">
        <PaymentModeBadge />
        <div className="pf-who">
          <div className="pf-avatar" aria-hidden="true">
            {initials(agent.name)}
          </div>
          <div>
            <b>{agent.name}</b>
            <span>
              {agent.role}, {agent.branch ?? "Nairobi"}
            </span>
          </div>
          <button type="button" onClick={handleLogout} className="pf-signout">
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
