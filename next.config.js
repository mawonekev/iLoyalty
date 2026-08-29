/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better dev-time warnings
  reactStrictMode: true,
  // Experimental: required for server actions
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig
