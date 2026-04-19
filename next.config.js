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
