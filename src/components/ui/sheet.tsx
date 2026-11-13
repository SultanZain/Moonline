/**
 * Source-owned shadcn sheet using Radix dialog semantics and focus management.
 * @author Sultan
 */
"use client";

import type { ComponentProps } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sheet(props: ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root {...props} />;
}

export function SheetTrigger(props: ComponentProps<typeof Dialog.Trigger>) {
  return <Dialog.Trigger {...props} />;
}

export function SheetContent({ className, children, side = "left", closeLabel = "Close", container, ...props }:
  ComponentProps<typeof Dialog.Content> & { side?: "left" | "right" | "bottom"; closeLabel?: string; container?: HTMLElement | null }) {
  return (
    <Dialog.Portal container={container}>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-background/80" />
      <Dialog.Content
        data-slot="sheet-content"
        className={cn("fixed z-50 flex w-full flex-col gap-6 overflow-y-auto border-border bg-surface p-6",
          side === "bottom" ? "inset-x-0 bottom-0 max-h-[65dvh] border-t" : "inset-y-0 max-w-sm",
          side === "left" && "left-0 border-r", side === "right" && "right-0 border-l", className)}
        {...props}
      >
        {children}
        <Dialog.Close asChild>
          <Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label={closeLabel}>
            <X aria-hidden="true" />
          </Button>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof Dialog.Title>) {
  return <Dialog.Title className={cn("text-lg font-semibold", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof Dialog.Description>) {
  return <Dialog.Description className={cn("text-sm text-content-muted", className)} {...props} />;
}
