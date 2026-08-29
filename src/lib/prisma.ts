import { PrismaClient } from '@prisma/client';

// Support DATABASE_URL, POSTGRES_URL, or PRISMA_DATABASE_URL from Vercel / Cloud Postgres
if (!process.env.DATABASE_URL) {
  if (process.env.POSTGRES_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_URL;
  } else if (process.env.PRISMA_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.PRISMA_DATABASE_URL;
  }
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function ensureDbInitialized() {
  // Cloud PostgreSQL tables are managed by Prisma migrations / db push
  return true;
}
