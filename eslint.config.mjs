/**
 * Enforce Next.js, React and TypeScript rules without scanning local skills.
 * @author Sultan
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**", "out/**", "next-env.d.ts", ".agents/**", ".taste-skill/**",
    "playwright-report/**", "test-results/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
    },
  },
]);
