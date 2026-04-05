/** @type {import('next').NextConfig} */
const nextConfig = {
  // Moved from experimental.serverComponentsExternalPackages (deprecated in Next.js 14.1)
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'jsonwebtoken', 'stripe'],

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
