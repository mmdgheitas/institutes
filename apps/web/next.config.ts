import type { NextConfig } from 'next';

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Dev convenience: /api/* on the web app proxies to the NestJS API so the
  // browser never needs a second origin. Production deployments should set
  // NEXT_PUBLIC_API_BASE_URL explicitly instead.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      {
        source: '/api/:path*',
        destination: `${API_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
