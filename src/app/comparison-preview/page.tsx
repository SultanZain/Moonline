/**
 * Compose the standalone illustrative comparison preview without scientific integrations.
 * @author Sultan
 */
import type { Metadata } from "next";
import { ComparisonWorkspace } from "@/components/comparison/comparison-workspace";

export const metadata: Metadata = { title: "Comparison preview" };

export default function ComparisonPreviewPage() {
  return <ComparisonWorkspace />;
}
