import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Keep production checks from overwriting an active development server.
  distDir: process.env.NODE_ENV === "production" ? ".next-production" : ".next",
  // Legacy provider modules retain lint debt; TypeScript remains enforced.
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
};
export default nextConfig;
