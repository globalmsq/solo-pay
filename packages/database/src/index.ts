// Export everything from Prisma client
export * from '@prisma/client';

// Export Prisma namespace (includes Decimal as Prisma.Decimal)
export { Prisma } from '@prisma/client';

// Export database utilities
export { getPrismaClient, disconnectPrisma } from './client';

// Re-export Decimal for convenience (both type and value)
import { Prisma } from '@prisma/client';
export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;
