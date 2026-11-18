/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@libsql/client', 'jsdom', '@mozilla/readability'],
  reactStrictMode: true,
};

export default nextConfig;
