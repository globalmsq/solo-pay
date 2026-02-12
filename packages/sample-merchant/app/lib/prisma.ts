import { PrismaClient } from '../generated/prisma/client';

// Prevent multiple PrismaClient instances during Next.js hot reload (dev mode)
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
