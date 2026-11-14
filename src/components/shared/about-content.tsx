/** Present contributor names, GitHub profiles and the tools used by Moonline. @author Sultan */
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

const contributors = [
  { name: "Muhammad Zain Ahsan", username: "SultanZain" },
  { name: "Rameen", username: "Mumei-Nocturnal" },
];

const technologies = [
  ["Next.js", "App Router and API routes"],
  ["React", "User interface"],
  ["TypeScript", "Typed application code"],
  ["Tailwind CSS", "Styling"],
  ["Radix UI", "Accessible controls"],
  ["OpenLayers", "Lunar map"],
  ["Apache ECharts", "Elevation charts"],
  ["Lucide React", "Icons"],
  ["NASA Moon Trek", "Imagery and location search"],
  ["NASA/JPL Horizons", "Sun and Earth geometry"],
];

export function AboutContent() {
  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="page-header">
      <div><h1>About Moonline</h1><p className="mt-2 text-sm text-content-muted">The people and technology behind the project.</p></div>
      <Button asChild variant="outline"><Link href="/explorer"><ArrowLeft aria-hidden="true" /> Back to Explorer</Link></Button>
    </header>
    <section aria-labelledby="contributors-heading">
      <h2 id="contributors-heading" className="mb-4">Built by</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {contributors.map(contributor => <article key={contributor.username} className="workspace-panel">
          <h3 className="text-lg font-medium text-content">{contributor.name}</h3>
          <a href={`https://github.com/${contributor.username}`} target="_blank" rel="noreferrer" className="source-link mt-3 text-sm text-content-muted">
            <Github aria-hidden="true" /> github.com/{contributor.username} <ArrowUpRight aria-hidden="true" />
          </a>
        </article>)}
      </div>
    </section>
    <section className="workspace-panel" aria-labelledby="technology-heading">
      <h2 id="technology-heading">Tech stack</h2>
      <table className="mt-4 w-full border-collapse text-left text-sm">
        <caption className="sr-only">Technologies used in Moonline and their purpose</caption>
        <thead><tr className="border-b border-border text-content-muted"><th scope="col" className="py-3 pr-4 font-medium">Technology</th><th scope="col" className="py-3 font-medium">Use</th></tr></thead>
        <tbody>{technologies.map(([technology, purpose]) => <tr key={technology} className="border-b border-border last:border-0">
          <th scope="row" className="py-3 pr-4 align-top font-medium">{technology}</th><td className="py-3 align-top text-content-muted">{purpose}</td>
        </tr>)}</tbody>
      </table>
    </section>
  </div>;
}
