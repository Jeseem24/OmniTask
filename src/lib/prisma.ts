import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Optimize SQLite for high concurrency (WAL mode + 5s busy timeout)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

try {
  prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;').catch(() => {});
  prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;').catch(() => {});
} catch (e) {}
