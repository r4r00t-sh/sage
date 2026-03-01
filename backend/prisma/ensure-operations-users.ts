/**
 * Ensures Operations (OPS) department has inward desk and other users so file
 * forwarding to OPS works. Safe to run on production: only creates users that
 * don't exist (no wipe). Run against target DB (e.g. production):
 *
 *   docker compose run --rm -e DATABASE_URL="postgresql://..." backend npx tsx prisma/ensure-operations-users.ts
 *
 * Or locally: docker compose run --rm backend npx tsx prisma/ensure-operations-users.ts
 */
import { PrismaClient, UserRole } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PASSWORD = 'password123';

const OPS_USERS = [
  { username: 'ops.admin', name: 'Operations Department Admin', role: UserRole.DEPT_ADMIN },
  { username: 'ops.office', name: 'Operations Section Officer', role: UserRole.SECTION_OFFICER },
  { username: 'ops.inward', name: 'Operations Inward Desk', role: UserRole.INWARD_DESK },
  { username: 'ops.dispatch', name: 'Operations Dispatcher', role: UserRole.DISPATCHER },
  { username: 'ops.approver', name: 'Operations Approval Authority', role: UserRole.APPROVAL_AUTHORITY },
  { username: 'ops.clerk', name: 'Operations Clerk', role: UserRole.USER },
  { username: 'ops.chat', name: 'Operations Chat Manager', role: UserRole.CHAT_MANAGER },
] as const;

async function main() {
  console.log('🔧 Ensuring Operations (OPS) department users exist...\n');

  const dept = await prisma.department.findUnique({
    where: { code: 'OPS' },
    include: {
      divisions: { orderBy: { createdAt: 'asc' }, take: 1 },
    },
  });

  if (!dept) {
    console.error('❌ Operations department (code OPS) not found. Run the full seed first to create departments.');
    process.exit(1);
  }

  const divisionId = dept.divisions[0]?.id ?? null;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let created = 0;
  let skipped = 0;

  for (const u of OPS_USERS) {
    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (existing) {
      // Optionally ensure they're in OPS so forwarding works
      if (existing.departmentId !== dept.id || existing.divisionId !== divisionId) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            departmentId: dept.id,
            divisionId: divisionId ?? undefined,
            isActive: true,
            profileApprovalStatus: 'APPROVED',
          },
        });
        console.log(`   ✅ Updated ${u.username} (department/division set to OPS)`);
      } else {
        skipped++;
      }
      continue;
    }

    await prisma.user.create({
      data: {
        username: u.username,
        passwordHash,
        name: u.name,
        email: `${u.username}@santhigiri.org`,
        roles: [u.role],
        departmentId: dept.id,
        divisionId: divisionId ?? undefined,
        isActive: true,
        profileApprovalStatus: 'APPROVED',
      },
    });
    created++;
    console.log(`   ✅ Created ${u.username} (${u.role})`);
  }

  // Ensure UserPoints for any user we created/updated in OPS
  const opsUsers = await prisma.user.findMany({
    where: { username: { in: OPS_USERS.map((x) => x.username) } },
    select: { id: true },
  });
  for (const u of opsUsers) {
    await prisma.userPoints.upsert({
      where: { userId: u.id },
      create: { userId: u.id, basePoints: 1000, currentPoints: 1000 },
      update: {},
    });
  }

  console.log(`\n✅ Done. Created: ${created}, already existed: ${skipped}`);
  console.log('   Inward desk user for OPS: ops.inward (password: password123)');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
