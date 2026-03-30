"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "案件列表" },
  { href: "/workflows", label: "工作流" },
  { href: "/settings", label: "设置" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header
      style={{
        borderBottom: "1px solid var(--stroke)",
        background: "var(--panel)",
      }}
    >
      <nav
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 1.5rem",
          height: "3.5rem",
          display: "flex",
          alignItems: "center",
          gap: "2rem",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "var(--foreground)",
            letterSpacing: "0.02em",
          }}
        >
          SuitAgent
        </Link>

        <div style={{ display: "flex", gap: "0.25rem", flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${isActive ? " active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.75rem",
            color: "var(--muted)",
          }}
        >
          <span
            style={{
              width: "0.5rem",
              height: "0.5rem",
              borderRadius: "50%",
              background: "var(--muted)",
              display: "inline-block",
            }}
          />
          Claude Code
        </div>
      </nav>
    </header>
  );
}
