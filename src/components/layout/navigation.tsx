/**
 * Link implemented destinations and indicate the current page on every viewport.
 * @author Sultan
 */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Map, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { explorerSessionLink, readExplorerSession } from "@/components/explorer/explorer-session";

const destinations = [
  { href: "/explorer", label: "Mission Explorer", icon: Map },
  { href: "/comparison-preview", label: "Site comparison", icon: Radar },
  { href: "/methodology", label: "Methodology", icon: BookOpen },
];

export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {destinations.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          title={label}
          aria-label={label}
          onClick={event => {
            if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0 &&
              (pathname === "/explorer" || pathname === "/comparison-preview") && (href === "/explorer" || href === "/comparison-preview")) {
              const read = readExplorerSession(window.location.search);
              if (read.status === "ready") {
                event.preventDefault();
                const destination = new URL(explorerSessionLink(read.session, new URL(href, window.location.origin).href));
                router.push(destination.pathname + destination.search);
              }
            }
            onNavigate?.();
          }}
          aria-current={pathname === href ? "page" : undefined}
          className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-content-muted transition-colors hover:bg-surface motion-reduce:transition-none", pathname === href && "bg-surface font-medium text-content")}
        >
          <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
          <span className="navigation-label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
