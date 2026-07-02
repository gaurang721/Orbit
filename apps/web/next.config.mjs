import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for Docker (traces from the monorepo root).
  output: 'standalone',
  outputFileTracingRoot: path.join(dirname, '../../'),
  // Compile the workspace TS packages instead of expecting prebuilt JS.
  transpilePackages: ['@fbclone/types', '@fbclone/ui'],
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    // Optional dev convenience: proxy /api/* to the backend so the web origin
    // and API origin match (avoids cross-site cookie nuances during local dev).
    const apiUrl = process.env.API_PROXY_URL;
    return apiUrl ? [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }] : [];
  },
};

export default nextConfig;
