/**
 * Prisma Client Singleton
 * Reuses client across warm invocations and caps serverless pool size
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getServerlessDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      if (!url.searchParams.has('connection_limit')) {
        url.searchParams.set('connection_limit', '1');
      }
      if (!url.searchParams.has('pool_timeout')) {
        url.searchParams.set('pool_timeout', '20');
      }
      if (url.port === '6543' && !url.searchParams.has('pgbouncer')) {
        url.searchParams.set('pgbouncer', 'true');
      }
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const datasourceUrl = getServerlessDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

globalForPrisma.prisma = prisma;
