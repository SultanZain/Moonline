/**
 * Compose the primary lunar exploration workspace.
 * @author Sultan
 */
import type { Metadata } from "next";
import { ExplorerWorkspace } from "@/components/explorer/explorer-workspace";

export const metadata: Metadata = { title: "Mission Explorer" };

export default function ExplorerPage() {
  return <ExplorerWorkspace />;
}
