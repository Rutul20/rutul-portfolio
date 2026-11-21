import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static HTML export: `next build` writes the whole site to ./out, servable by any static host.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // keeps the dev badge out of QA screenshots and the build-time city renders
  devIndicators: false,
};

export default nextConfig;
