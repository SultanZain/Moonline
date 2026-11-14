/** Keep existing comparison links working at the live canonical address. @author Sultan */
import { redirect } from "next/navigation";

export default async function LegacyComparisonPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parameters = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  redirect(`/comparison${query.size ? `?${query}` : ""}`);
}
