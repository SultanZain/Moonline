/**
 * Merge source-owned UI classes while resolving conflicting Tailwind utilities.
 * @author Sultan
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
