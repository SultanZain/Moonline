/**
 * Restore comparison inputs and compose the live site-comparison workspace.
 * @author Sultan
 */
import type { Metadata } from "next";
import { ComparisonWorkspace } from "@/components/comparison/comparison-workspace";
import { emptyExplorerSession, readExplorerSession } from "@/components/explorer/explorer-session";

export const metadata: Metadata = { title: "Site comparison" };

export default async function ComparisonPage({ searchParams }: { searchParams: Promise<{ session?: string | string[] }> }) {
  const parameters = await searchParams;
  const query = new URLSearchParams();
  for (const value of Array.isArray(parameters.session) ? parameters.session : parameters.session === undefined ? [] : [parameters.session]) query.append("session", value);
  const read = readExplorerSession(query.toString());
  const session = read.status === "ready" ? read.session : emptyExplorerSession();
  const initialTime = read.status === "ready" ? session.missionTimeUtc?.slice(0, 16) ?? "" : new Date().toISOString().slice(0, 16);
  return <ComparisonWorkspace initialSession={session} initialTime={initialTime} invalidSession={read.status === "invalid"} />;
}
