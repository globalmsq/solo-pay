import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prisma와 Next.js 16 (Turbopack) 호환성 설정
  serverExternalPackages: ['@prisma/client', '@prisma/engines', 'prisma'],

  // Turbopack 설정
  turbopack: {},
};

export default nextConfig;
