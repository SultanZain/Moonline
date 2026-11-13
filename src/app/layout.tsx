/**
 * Supply document metadata, locally hosted typography and the shared application shell.
 * @author Sultan
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "./globals.css";
import { ApplicationShell } from "@/components/layout/application-shell";

export const metadata: Metadata = {
  title: { default: "Moonline · Lunar exploration", template: "%s · Moonline" },
  description: "A lunar exploration workspace for inspecting Sun and Earth geometry, with traceable methods and explicit data limitations.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><ApplicationShell>{children}</ApplicationShell></body></html>;
}
