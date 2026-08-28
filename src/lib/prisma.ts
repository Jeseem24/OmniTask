import { PrismaClient } from '@prisma/client';

// On Vercel / AWS Lambda, the root folder is read-only.
// We auto-route SQLite to /tmp/dev.db if a cloud DATABASE_URL is not provided.
if (process.env.VERCEL && (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:.'))) {
  process.env.DATABASE_URL = 'file:/tmp/dev.db';
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

// Auto-initialize tables in SQLite if running for the first time
let isDbInitialized = false;

export async function ensureDbInitialized() {
  if (isDbInitialized) return;
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;').catch(() => {});
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;').catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Subject" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "code" TEXT,
        "name" TEXT NOT NULL,
        "colorHex" TEXT NOT NULL DEFAULT '#3B82F6',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Source" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "type" TEXT NOT NULL,
        "rawContent" TEXT,
        "filePath" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CandidateExtraction" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "sourceId" TEXT NOT NULL,
        "extractedJson" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Task" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "sourceId" TEXT,
        "parentTaskId" TEXT,
        "subjectId" TEXT,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "taskType" TEXT NOT NULL DEFAULT 'ASSIGNMENT',
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "priorityScore" REAL NOT NULL DEFAULT 0.0,
        "importance" INTEGER NOT NULL DEFAULT 3,
        "deadline" DATETIME,
        "isDeadlineAmbiguous" BOOLEAN NOT NULL DEFAULT false,
        "estimatedEffortMins" INTEGER NOT NULL DEFAULT 30,
        "actualEffortMins" INTEGER,
        "aiConfidence" REAL DEFAULT 1.0,
        "userModified" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" DATETIME,
        FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY ("parentTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `).catch(() => {});

    isDbInitialized = true;
  } catch (err) {
    console.error('Database auto-initialization error:', err);
  }
}

// Kick off auto-initialization in the background
ensureDbInitialized().catch(() => {});
