/**
 * Link implemented destinations and indicate the current page on every viewport.
 * @author Sultan
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Map, Radar } from "lucide-react";
import { cn } from "@/lib/utils";

const destinations = [
  { href: "/explorer", label: "Mission Explorer", icon: Map },
  { href: "/comparison-preview", label: "Comparison preview", icon: Radar },
  { href: "/methodology", label: "Methodology", icon: BookOpen },
];

export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {destinations.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={pathname === href ? "page" : undefined}
          className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-content-muted transition-colors hover:bg-surface motion-reduce:transition-none", pathname === href && "bg-surface font-medium text-content")}
        >
          <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
