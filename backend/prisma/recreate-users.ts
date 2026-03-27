import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🗑️  Deleting test users (keeping super admin)...');
  
  // First, get all users except super admin
  const usersToDelete = await prisma.user.findMany({
    where: {
      username: {
        not: 'super.admin',
      },
    },
    select: { id: true },
  });

  if (usersToDelete.length > 0) {
    const userIds = usersToDelete.map(u => u.id);
    
    // Get super admin ID to reassign files
    const superAdmin = await prisma.user.findUnique({
      where: { username: 'super.admin' },
      select: { id: true },
    });
    
    // Delete related records first
    console.log('   Cleaning up related records...');
    await prisma.userPoints.deleteMany({
      where: { userId: { in: userIds } },
    });
    
    // Update file routing to remove references
    if (superAdmin) {
      await prisma.fileRouting.updateMany({
        where: { fromUserId: { in: userIds } },
        data: { fromUserId: superAdmin.id },
      });
      await prisma.fileRouting.updateMany({
        where: { toUserId: { in: userIds } },
        data: { toUserId: superAdmin.id },
      });
      await prisma.file.updateMany({
        where: { createdById: { in: userIds } },
        data: { createdById: superAdmin.id },
      });
      await prisma.file.updateMany({
        where: { assignedToId: { in: userIds } },
        data: { assignedToId: superAdmin.id },
      });
    } else {
      // If no super admin, just unassign
      await prisma.file.updateMany({
        where: { assignedToId: { in: userIds } },
        data: { assignedToId: null },
      });
    }
    
    // Now delete users
    const deleted = await prisma.user.deleteMany({
      where: {
        id: { in: userIds },
      },
    });
    console.log(`✅ Deleted ${deleted.count} test users`);
  } else {
    console.log('✅ No test users to delete');
  }

  console.log('\n📋 Fetching departments and divisions...');
  
  // Get all departments
  const departments = await prisma.department.findMany({
    include: {
      divisions: {
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`✅ Found ${departments.length} departments`);

  const passwordHash = await bcrypt.hash('password123', 10);
  const defaultPassword = 'password123';

  let totalUsersCreated = 0;

  for (const dept of departments) {
    console.log(`\n📁 Processing: ${dept.name}`);
    
    // Get first 2 divisions for this department
    const selectedDivisions = dept.divisions.slice(0, 2);
    
    if (selectedDivisions.length === 0) {
      console.log(`   ⚠️  No divisions found, skipping...`);
      continue;
    }

    // Create Department Admin (assigned to first division)
    const deptAdminUsername = `${dept.code.toLowerCase()}.admin`;
    const deptAdmin = await prisma.user.create({
      data: {
        username: deptAdminUsername,
        passwordHash,
        name: `${dept.name} Admin`,
        email: `${dept.code.toLowerCase()}.admin@santhigiri.org`,
        roles: [UserRole.DEPT_ADMIN],
        departmentId: dept.id,
        divisionId: selectedDivisions[0].id,
        profileApprovalStatus: 'APPROVED',
      },
    });
    await prisma.userPoints.create({
      data: {
        userId: deptAdmin.id,
        basePoints: 1000,
        currentPoints: 1000,
      },
    });
    console.log(`   ✅ Created Dept Admin: ${deptAdminUsername}`);
    totalUsersCreated++;

    // Create users for each of the 2 selected divisions
    for (let divIndex = 0; divIndex < selectedDivisions.length; divIndex++) {
      const division = selectedDivisions[divIndex];
      console.log(`   📂 Division: ${division.name}`);
      
      // Generate unique division code for username
      // Use division code + index to ensure uniqueness
      const divCodePart = (division.code.split('-').slice(1).join('-').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'div') + divIndex;
      
      // Create Section Officer
      const sectionOfficerUsername = `${dept.code.toLowerCase()}.${divCodePart}.section`;
      const sectionOfficer = await prisma.user.create({
        data: {
          username: sectionOfficerUsername,
          passwordHash,
          name: `${division.name} - Section Officer`,
          email: `${sectionOfficerUsername}@santhigiri.org`,
          roles: [UserRole.SECTION_OFFICER],
          departmentId: dept.id,
          divisionId: division.id,
          profileApprovalStatus: 'APPROVED',
        },
      });
      await prisma.userPoints.create({
        data: {
          userId: sectionOfficer.id,
          basePoints: 1000,
          currentPoints: 1000,
        },
      });
      console.log(`      ✅ Section Officer: ${sectionOfficerUsername}`);
      totalUsersCreated++;

      // Create Approval Authority
      const approverUsername = `${dept.code.toLowerCase()}.${divCodePart}.approver`;
      const approver = await prisma.user.create({
        data: {
          username: approverUsername,
          passwordHash,
          name: `${division.name} - Approval Authority`,
          email: `${approverUsername}@santhigiri.org`,
          roles: [UserRole.APPROVAL_AUTHORITY],
          departmentId: dept.id,
          divisionId: division.id,
          profileApprovalStatus: 'APPROVED',
        },
      });
      await prisma.userPoints.create({
        data: {
          userId: approver.id,
          basePoints: 1000,
          currentPoints: 1000,
        },
      });
      console.log(`      ✅ Approval Authority: ${approverUsername}`);
      totalUsersCreated++;

      // Create Dispatcher
      const dispatcherUsername = `${dept.code.toLowerCase()}.${divCodePart}.dispatch`;
      const dispatcher = await prisma.user.create({
        data: {
          username: dispatcherUsername,
          passwordHash,
          name: `${division.name} - Dispatcher`,
          email: `${dispatcherUsername}@santhigiri.org`,
          roles: [UserRole.DISPATCHER],
          departmentId: dept.id,
          divisionId: division.id,
          profileApprovalStatus: 'APPROVED',
        },
      });
      await prisma.userPoints.create({
        data: {
          userId: dispatcher.id,
          basePoints: 1000,
          currentPoints: 1000,
        },
      });
      console.log(`      ✅ Dispatcher: ${dispatcherUsername}`);
      totalUsersCreated++;

      // Create Inward Desk
      const inwardDeskUsername = `${dept.code.toLowerCase()}.${divCodePart}.inward`;
      const inwardDesk = await prisma.user.create({
        data: {
          username: inwardDeskUsername,
          passwordHash,
          name: `${division.name} - Inward Desk`,
          email: `${inwardDeskUsername}@santhigiri.org`,
          roles: [UserRole.INWARD_DESK],
          departmentId: dept.id,
          divisionId: division.id,
          profileApprovalStatus: 'APPROVED',
        },
      });
      await prisma.userPoints.create({
        data: {
          userId: inwardDesk.id,
          basePoints: 1000,
          currentPoints: 1000,
        },
      });
      console.log(`      ✅ Inward Desk: ${inwardDeskUsername}`);
      totalUsersCreated++;
    }
  }

  console.log(`\n✅ Total users created: ${totalUsersCreated}`);
  console.log(`\n📝 Default password for all users: ${defaultPassword}`);
  console.log(`\n✨ User creation complete!`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

