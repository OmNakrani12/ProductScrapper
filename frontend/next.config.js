/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    const rawTarget = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').trim().replace(/\/+$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${rawTarget}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
