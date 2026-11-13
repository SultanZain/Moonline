/**
 * Source-owned shadcn input styled with Moonline's control and focus tokens.
 * @author Sultan
 */
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input data-slot="input" className={cn(
    "h-11 w-full min-w-0 rounded-md border border-control bg-surface px-3 text-sm text-content placeholder:text-content-subtle disabled:opacity-60",
    className,
  )} {...props} />;
}
