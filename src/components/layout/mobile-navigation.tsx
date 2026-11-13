/**
 * Provide keyboard-accessible navigation on mobile and tablet through a Radix sheet.
 * @author Sultan
 */
"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Brand } from "@/components/layout/brand";
import { Navigation } from "@/components/layout/navigation";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border px-4 lg:hidden">
      <Brand />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation">
            <Menu aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent closeLabel="Close navigation">
          <SheetTitle>Moonline navigation</SheetTitle>
          <SheetDescription>Lunar exploration workspace</SheetDescription>
          <Navigation onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
