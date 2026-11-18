/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['node:sqlite', 'jsdom', '@mozilla/readability'],
  reactStrictMode: true,
};

export default nextConfig;
