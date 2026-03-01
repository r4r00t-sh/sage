/**
 * One-time fix: set all users to isActive: true and profileApprovalStatus: APPROVED
 * so every seeded user can log in (not just Super Admin and Dept Admin).
 * Run in Docker: docker compose run --rm backend npx tsx prisma/fix-all-users-login.ts
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required (e.g. run via: docker compose run --rm backend npx tsx prisma/fix-all-users-login.ts)');
  process.exit(1);
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔧 Ensuring all users can log in (isActive + profileApprovalStatus)...\n');

  const result = await prisma.user.updateMany({
    data: {
      isActive: true,
      profileApprovalStatus: 'APPROVED',
    },
  });

  console.log(`✅ Updated ${result.count} user(s)`);
  console.log('   - Set isActive: true');
  console.log('   - Set profileApprovalStatus: APPROVED\n');

  const users = await prisma.user.findMany({
    select: { username: true, name: true, roles: true, isActive: true, profileApprovalStatus: true },
    orderBy: { username: 'asc' },
  });

  console.log('📋 All users:');
  users.forEach((u) => {
    const roles = Array.isArray(u.roles) ? u.roles.join(', ') : String(u.roles);
    console.log(`   ${u.username} (${u.name}) [${roles}] active=${u.isActive} approved=${u.profileApprovalStatus ?? 'null'}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
