/**
 * Compose the scientific scope, provenance and limitations view.
 * @author Sultan
 */
import type { Metadata } from "next";
import { MethodologyContent } from "@/components/shared/methodology-content";

export const metadata: Metadata = { title: "Methodology" };

export default function MethodologyPage() {
  return <MethodologyContent />;
}
