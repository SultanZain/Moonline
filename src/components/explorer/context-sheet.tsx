/**
 * Keep site context accessible without squeezing the mobile/tablet lunar workspace.
 * @author Sultan
 */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function ContextSheet({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const onChange = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="xl:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline"><PanelRight aria-hidden="true" /> Site context</Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          closeLabel="Close site context"
          className="gap-4 p-0"
          onCloseAutoFocus={event => {
            if (window.matchMedia("(min-width: 1280px)").matches) {
              event.preventDefault();
              document.getElementById("main-content")?.focus();
            }
          }}
        >
          <div className="px-6 pt-6 pr-16">
            <SheetTitle>Site context</SheetTitle>
            <SheetDescription className="mt-2">Observer and visibility availability.</SheetDescription>
          </div>
          <div className="space-y-4">{children}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
