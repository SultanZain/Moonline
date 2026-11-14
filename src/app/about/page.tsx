/** Compose the project credits and the technology stack overview. @author Sultan */
import type { Metadata } from "next";
import { AboutContent } from "@/components/shared/about-content";

export const metadata: Metadata = { title: "About Moonline" };

export default function AboutPage() {
  return <AboutContent />;
}
