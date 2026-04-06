/** @type {import('next').NextConfig} */
const nextConfig = {
  // In Next.js 14.2, serverComponentsExternalPackages is still under experimental
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'jsonwebtoken', 'stripe'],
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
}

module.exports = nextConfig
