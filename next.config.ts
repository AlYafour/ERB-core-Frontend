import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  compress: true,

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Cloudinary CDN (media files)
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      // Railway backend (production)
      { protocol: 'https', hostname: '*.railway.app',      pathname: '/**' },
      { protocol: 'https', hostname: '*.up.railway.app',   pathname: '/**' },
      // Local development
      { protocol: 'http',  hostname: 'localhost',   port: '9000', pathname: '/**' },
      { protocol: 'http',  hostname: '127.0.0.1',   port: '9000', pathname: '/**' },
      { protocol: 'http',  hostname: 'localhost',   port: '7410', pathname: '/**' },
      { protocol: 'http',  hostname: '127.0.0.1',   port: '7410', pathname: '/**' },
    ],
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack(config: any, { isServer }: { isServer: boolean }) {
    if (!isServer) {
      const sc = (config.optimization as any)?.splitChunks ?? {};
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...sc,
          cacheGroups: {
            ...(sc.cacheGroups ?? {}),
            recharts: {
              name: 'recharts',
              test: /[\\/]node_modules[\\/](recharts|d3-[^/\\]+)[\\/]/,
              chunks: 'all' as const,
              priority: 20,
            },
          },
        },
      };
    }
    return config;
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY' },
        ],
      },
      {
        // Static assets: 1 year immutable cache (Vercel CDN handles this)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Public images: 7 days cache
        source: '/(.*)\\.(png|jpg|jpeg|gif|svg|ico|webp|avif)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
    ];
  },
};

const sentryOptions = {
  silent: true,
  disableLogger: true,
  widenClientFileUpload: true,
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;
