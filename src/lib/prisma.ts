import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Prefer direct POSTGRES_URL if available on Vercel
const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
