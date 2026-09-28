/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // Increase timeout for API routes (Vercel Pro plan allows up to 60s)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
