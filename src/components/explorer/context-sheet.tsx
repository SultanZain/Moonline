/**
 * Present a dismissible map inspector and a mobile bottom sheet inside the fullscreen map.
 * Desktop context stays nonmodal so the surface remains interactive.
 * @author Sultan
 */
"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

function subscribe(callback: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const isMobile = () => window.matchMedia("(max-width: 767px)").matches;
const serverSnapshot = () => false;

export function ContextSheet({ open, onOpenChange, container, onReturnFocus, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: HTMLElement | null;
  onReturnFocus: () => void;
  children: ReactNode;
}) {
  const mobile = useSyncExternalStore(subscribe, isMobile, serverSnapshot);

  if (mobile) return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" container={container} closeLabel="Close site inspector" className="map-inspector-sheet gap-4"
        onCloseAutoFocus={event => { event.preventDefault(); onReturnFocus(); }}>
        <SheetTitle>Site inspector</SheetTitle>
        <SheetDescription className="sr-only">Selected map location and candidate sites.</SheetDescription>
        {children}
      </SheetContent>
    </Sheet>
  );

  return open ? (
    <aside className="map-inspector map-surface" aria-label="Site inspector">
      <div className="flex items-center justify-between gap-3 pb-4">
        <h2 className="text-sm">Site inspector</h2>
        <Button variant="ghost" size="icon" className="-mr-2 -my-2" aria-label="Close site inspector" title="Close site inspector"
          onClick={() => { onOpenChange(false); onReturnFocus(); }}><X aria-hidden="true" /></Button>
      </div>
      {children}
    </aside>
  ) : null;
}
