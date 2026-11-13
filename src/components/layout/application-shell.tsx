/**
 * Compose the shared responsive workspace without coupling it to scientific state.
 * @author Sultan
 */
import type { ReactNode } from "react";
import { Brand } from "@/components/layout/brand";
import { Navigation } from "@/components/layout/navigation";
import { MobileNavigation } from "@/components/layout/mobile-navigation";

export function ApplicationShell({ children }: { children: ReactNode }) {
  return (
    <div className="application-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className="workspace-sidebar hidden min-h-screen flex-col gap-8 border-r border-border px-4 py-6 lg:flex" aria-label="Workspace sidebar">
        <div className="px-3"><Brand /><p className="mt-3 text-xs text-content-subtle">Lunar exploration workspace</p></div>
        <Navigation />
        <div className="mt-auto px-3 text-xs leading-5 text-content-subtle">
          <p className="font-medium text-content-muted">Scientific planning aid</p>
          <p className="mt-2">Geometric visibility does not establish landing safety, usable power, or a communications link.</p>
        </div>
      </aside>
      <div className="min-w-0">
        <MobileNavigation />
        <main id="main-content" tabIndex={-1} className="workspace-main">{children}</main>
      </div>
    </div>
  );
}
