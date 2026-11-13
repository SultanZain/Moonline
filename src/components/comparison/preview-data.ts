/**
 * Supply explicitly synthetic display fixtures for the independent comparison preview.
 * These are UI examples, not lunar sites, provider results or scientific contracts.
 * @author Sultan
 */
export const previewAxes = [
  { id: "sun", label: "Sun above horizon", chartLabel: "Sun above\nhorizon", description: "Illustrative share of the scheduled samples with the Sun above an ideal geometric horizon." },
  { id: "earth", label: "Earth above horizon", chartLabel: "Earth above\nhorizon", description: "Illustrative share of the scheduled samples with Earth above an ideal geometric horizon." },
  { id: "joint", label: "Both above horizon", chartLabel: "Both above\nhorizon", description: "Illustrative share of the scheduled samples with both objects above the ideal geometric horizon." },
  { id: "sunCoverage", label: "Sun sample coverage", chartLabel: "Sun data\ncoverage", description: "Illustrative share of scheduled Sun samples with an available value. Coverage describes data completeness." },
  { id: "earthCoverage", label: "Earth sample coverage", chartLabel: "Earth data\ncoverage", description: "Illustrative share of scheduled Earth samples with an available value. Missing samples are unknown." },
] as const;

export type PreviewAxisId = typeof previewAxes[number]["id"];
export type PreviewValue = { state: "known"; percent: number } | { state: "unavailable" };
export type PreviewProfile = {
  id: "a" | "b";
  label: string;
  colorToken: "--comparison-a" | "--comparison-b";
  line: "solid" | "dashed";
  values: Record<PreviewAxisId, PreviewValue>;
};

export const completePreview: readonly PreviewProfile[] = [
  {
    id: "a", label: "Example site A", colorToken: "--comparison-a", line: "solid",
    values: { sun: { state: "known", percent: 78 }, earth: { state: "known", percent: 54 },
      joint: { state: "known", percent: 42 }, sunCoverage: { state: "known", percent: 100 },
      earthCoverage: { state: "known", percent: 92 } },
  },
  {
    id: "b", label: "Example site B", colorToken: "--comparison-b", line: "dashed",
    values: { sun: { state: "known", percent: 54 }, earth: { state: "known", percent: 82 },
      joint: { state: "known", percent: 48 }, sunCoverage: { state: "known", percent: 88 },
      earthCoverage: { state: "known", percent: 100 } },
  },
];

export const missingPreview: readonly PreviewProfile[] = completePreview.map(profile =>
  profile.id === "b" ? { ...profile, values: { ...profile.values, joint: { state: "unavailable" } } } : profile,
);

export function previewValueLabel(value: PreviewValue): string {
  switch (value.state) {
    case "known": return `${value.percent}%`;
    case "unavailable": return "Unavailable";
  }
}
