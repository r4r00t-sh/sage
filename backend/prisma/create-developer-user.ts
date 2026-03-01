/**
 * Create or update the developer user (god-level, no department).
 * Run: npx tsx prisma/create-developer-user.ts
 * Or with Docker: docker compose run --rm backend npx tsx prisma/create-developer-user.ts
 */
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEVELOPER_USER = {
  username: 'keerthanan',
  name: 'keerthanan',
  email: 'keerthananps88@gmail.com',
  password: 'K33rth4n4n@588$',
  roles: [UserRole.DEVELOPER] as UserRole[],
};

async function main() {
  const passwordHash = await bcrypt.hash(DEVELOPER_USER.password, 10);
  const user = await prisma.user.upsert({
    where: { username: DEVELOPER_USER.username },
    update: {
      name: DEVELOPER_USER.name,
      email: DEVELOPER_USER.email,
      passwordHash,
      roles: DEVELOPER_USER.roles,
      departmentId: null,
      divisionId: null,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
    },
    create: {
      username: DEVELOPER_USER.username,
      name: DEVELOPER_USER.name,
      email: DEVELOPER_USER.email,
      passwordHash,
      roles: DEVELOPER_USER.roles,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
    },
  });
  console.log('✅ Developer user ready:', user.username, user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
