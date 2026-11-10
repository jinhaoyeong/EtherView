import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const configDirectory = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: configDirectory,
});

const eslintConfig = [
  { ignores: [".next/**", ".next-production/**", ".cloudflare/**", ".vinext/**", "node_modules/**", "out/**", "dist/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
