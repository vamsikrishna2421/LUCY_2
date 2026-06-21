import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this dir — a stray lockfile in the user's home
  // would otherwise make Next infer the wrong root for file tracing.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
