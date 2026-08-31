/** @type {import('next').NextConfig} */
const nextConfig = {
  // In Next.js 14.2, serverComponentsExternalPackages is still under experimental
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'jsonwebtoken', 'stripe', 'resend'],
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },

  async redirects() {
    return [
      // The TWA's Digital Asset Links verification (assetlinks.json) is only
      // published for the apex domain. www resolving independently (rather
      // than 404ing or redirecting) is a live, unverified origin a stray
      // link/bookmark could land on — even though the TWA's own launch URL
      // never references it, closing it removes that exposure entirely.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.usedcarsdoctor.com' }],
        destination: 'https://usedcarsdoctor.com/:path*',
        permanent: true,
      },
    ]
  },

  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
      {
        // Digital Asset Links — must be served with correct Content-Type for TWA verification
        source: '/.well-known/assetlinks.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
