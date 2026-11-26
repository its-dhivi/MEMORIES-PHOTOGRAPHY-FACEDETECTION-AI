import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@memories/ui', '@memories/types'],
  experimental: { optimizePackageImports: ['lucide-react'] },
  poweredByHeader: false,
};
export default nextConfig;
