/**
 * Health check endpoint
 * Verifies Postgres connectivity and Python solver availability
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSolverHealth } from '@/lib/solver-client';

export async function GET() {
  try {
    // Check Postgres connectivity
    await prisma.$queryRaw`SELECT 1`;
    const postgresHealthy = true;

    // Check Python solver
    const solverHealth = await checkSolverHealth();

    const healthy = postgresHealthy && solverHealth.healthy;

    return NextResponse.json(
      {
        healthy,
        services: {
          postgres: { healthy: postgresHealthy },
          solver: { healthy: solverHealth.healthy, version: solverHealth.version },
        },
        timestamp: new Date().toISOString(),
      },
      { status: healthy ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
