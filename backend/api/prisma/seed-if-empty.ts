import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count().catch(() => 0);
  const podCount = await prisma.pod.count().catch(() => 0);

  if (userCount === 0 || podCount === 0) {
    console.log('Empty database detected. Running initial seed...');
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
  } else {
    console.log(`Database already seeded (${podCount} pods, ${userCount} users). Skipping seed.`);
  }
}

main()
  .catch((err) => {
    console.error('seed-if-empty error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
