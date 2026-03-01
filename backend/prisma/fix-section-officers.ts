import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing section officer accounts...');

  // Find all section officers
  const sectionOfficers = await prisma.user.findMany({
    where: {
      roles: {
        has: UserRole.SECTION_OFFICER,
      },
    },
  });

  console.log(`Found ${sectionOfficers.length} section officer(s)`);

  // Update all section officers to be active and approved
  const result = await prisma.user.updateMany({
    where: {
      roles: {
        has: UserRole.SECTION_OFFICER,
      },
    },
    data: {
      isActive: true,
      profileApprovalStatus: 'APPROVED',
    },
  });

  console.log(`✅ Updated ${result.count} section officer(s)`);
  console.log('   - Set isActive: true');
  console.log('   - Set profileApprovalStatus: APPROVED');

  // List all section officers with their usernames
  const updatedOfficers = await prisma.user.findMany({
    where: {
      roles: {
        has: UserRole.SECTION_OFFICER,
      },
    },
    select: {
      username: true,
      name: true,
      isActive: true,
      profileApprovalStatus: true,
    },
  });

  console.log('\n📋 Section Officers:');
  updatedOfficers.forEach((officer) => {
    console.log(`   - ${officer.username} (${officer.name})`);
    console.log(`     Active: ${officer.isActive}, Approved: ${officer.profileApprovalStatus}`);
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

