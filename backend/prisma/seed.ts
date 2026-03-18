import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Minimal demo structure: 5 departments with one division each
const CORE_DEPARTMENTS: { name: string; code: string; divisionName: string }[] = [
  { name: 'General Administration', code: 'GEN', divisionName: 'GEN Main Division' },
  { name: 'Finance', code: 'FIN', divisionName: 'FIN Main Division' },
  { name: 'Human Resources', code: 'HR', divisionName: 'HR Main Division' },
  { name: 'Operations', code: 'OPS', divisionName: 'OPS Main Division' },
  { name: 'IT Services', code: 'IT', divisionName: 'IT Main Division' },
];

function divisionCode(name: string, index: number): string {
  const slug = name
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12);
  return (slug || `DIV${index}`).toUpperCase();
}

async function main() {
  console.log('🌱 Starting seed...');

  // --- Cleanup: remove all existing data ---
  console.log('🧹 Cleaning up existing data...');
  await prisma.fileRouting.deleteMany({});
  await prisma.note.deleteMany({});
  await prisma.attachment.deleteMany({});
  await prisma.timeExtensionRequest.deleteMany({});
  await prisma.opinionNote.deleteMany({});
  await prisma.opinionRequest.deleteMany({});
  await prisma.dispatchProof.deleteMany({});
  await prisma.fileMovement.deleteMany({});
  await prisma.redFlag.deleteMany({});
  await prisma.fileBackFileLink.deleteMany({});
  await prisma.coinTransaction.deleteMany({});
  await prisma.workflowExecutionStep.deleteMany({});
  await prisma.workflowExecution.deleteMany({});
  await prisma.file.deleteMany({});
  await prisma.backFileTag.deleteMany({});
  await prisma.backFile.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.pointsTransaction.deleteMany({});
  await prisma.presence.deleteMany({});
  await prisma.loginSession.deleteMany({});
  await prisma.workingHours.deleteMany({});
  await prisma.performanceBadge.deleteMany({});
  await prisma.chatReadReceipt.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.chatConversationMember.deleteMany({});
  await prisma.chatConversation.deleteMany({});
  await prisma.workflowEdge.deleteMany({});
  await prisma.workflowNode.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.desk.deleteMany({});
  await prisma.division.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.userPoints.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organisation.deleteMany({});

  // Organisation
  const org = await prisma.organisation.create({
    data: {
      id: 'org-santhigiri-001',
      name: 'Santhigiri Ashram',
    },
  });
  console.log('✅ Organisation:', org.name);

  // 5 Departments and 1 Division per department
  const departmentByCode = new Map<string, string>();
  const divisionByCode = new Map<string, string>();

  for (const dept of CORE_DEPARTMENTS) {
    const createdDept = await prisma.department.create({
      data: {
        name: dept.name,
        code: dept.code,
        organisationId: org.id,
      },
    });
    departmentByCode.set(dept.code, createdDept.id);

    const divCode = `${dept.code}-${divisionCode(dept.divisionName, 0)}`;
    const createdDiv = await prisma.division.create({
      data: {
        name: dept.divisionName,
        code: divCode,
        departmentId: createdDept.id,
      },
    });
    divisionByCode.set(dept.code, createdDiv.id);
  }

  console.log('✅ Departments created:', CORE_DEPARTMENTS.length);
  console.log('✅ Divisions created:', CORE_DEPARTMENTS.length);

  const passwordHash = await bcrypt.hash('password123', 10);

  // Super Admin (no department)
  const superAdmin = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      name: 'Super Administrator',
      email: 'admin@example.com',
      roles: [UserRole.SUPER_ADMIN],
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Super Administrator',
      staffId: 'STAFF-001',
      phone: '+91 9000000001',
      firstName: 'Super',
      lastName: 'Administrator',
      employmentType: 'Permanent',
      dateOfJoining: new Date('2022-01-01'),
      workLocation: 'Head Office',
      accountStatus: 'Active',
      personalEmail: 'admin.personal@example.com',
      address: 'Head Office Campus, Santhigiri',
      city: 'Thiruvananthapuram',
      postalCode: '695589',
      profileCompletedAt: new Date(),
    },
  });
  console.log('✅ Super Admin:', superAdmin.username);

  // 5 users per department (5 roles) attached to the single division
  const deptUsers: typeof superAdmin[] = [];
  let staffCounter = 2;

  for (const dept of CORE_DEPARTMENTS) {
    const deptId = departmentByCode.get(dept.code)!;
    const divId = divisionByCode.get(dept.code)!;
    const baseUsername = dept.code.toLowerCase();

    const admin = await prisma.user.create({
      data: {
        username: `${baseUsername}.admin`,
        passwordHash,
        name: `${dept.name} Admin`,
        email: `${baseUsername}.admin@example.com`,
        roles: [UserRole.DEPT_ADMIN],
        departmentId: deptId,
        divisionId: divId,
        isActive: true,
        profileApprovalStatus: 'APPROVED',
        designation: 'Department Admin',
        staffId: `STAFF-${String(staffCounter++).padStart(3, '0')}`,
        phone: '+91 9000000101',
        firstName: dept.name,
        lastName: 'Admin',
        employmentType: 'Permanent',
        dateOfJoining: new Date('2023-01-01'),
        workLocation: `${dept.name} Block`,
        accountStatus: 'Active',
        personalEmail: `${baseUsername}.admin.personal@example.com`,
        address: `${dept.name} Block, Santhigiri`,
        city: 'Thiruvananthapuram',
        postalCode: '695589',
        profileCompletedAt: new Date(),
      },
    });

    const sectionOfficer = await prisma.user.create({
      data: {
        username: `${baseUsername}.section`,
        passwordHash,
        name: `${dept.name} Section Officer`,
        email: `${baseUsername}.section@example.com`,
        roles: [UserRole.SECTION_OFFICER],
        departmentId: deptId,
        divisionId: divId,
        isActive: true,
        profileApprovalStatus: 'APPROVED',
        designation: 'Section Officer',
        staffId: `STAFF-${String(staffCounter++).padStart(3, '0')}`,
        phone: '+91 9000000201',
        firstName: dept.name,
        lastName: 'Section Officer',
        employmentType: 'Permanent',
        dateOfJoining: new Date('2023-01-15'),
        workLocation: `${dept.name} Section`,
        accountStatus: 'Active',
        personalEmail: `${baseUsername}.section.personal@example.com`,
        address: `${dept.name} Section, Santhigiri`,
        city: 'Thiruvananthapuram',
        postalCode: '695589',
        profileCompletedAt: new Date(),
      },
    });

    const inwardDesk = await prisma.user.create({
      data: {
        username: `${baseUsername}.inward`,
        passwordHash,
        name: `${dept.name} Inward Desk`,
        email: `${baseUsername}.inward@example.com`,
        roles: [UserRole.INWARD_DESK],
        departmentId: deptId,
        divisionId: divId,
        isActive: true,
        profileApprovalStatus: 'APPROVED',
        designation: 'Inward Desk',
        staffId: `STAFF-${String(staffCounter++).padStart(3, '0')}`,
        phone: '+91 9000000301',
        firstName: dept.name,
        lastName: 'Inward Desk',
        employmentType: 'Permanent',
        dateOfJoining: new Date('2023-02-01'),
        workLocation: `${dept.name} Inward`,
        accountStatus: 'Active',
        personalEmail: `${baseUsername}.inward.personal@example.com`,
        address: `${dept.name} Inward Desk, Santhigiri`,
        city: 'Thiruvananthapuram',
        postalCode: '695589',
        profileCompletedAt: new Date(),
      },
    });

    const dispatcher = await prisma.user.create({
      data: {
        username: `${baseUsername}.dispatch`,
        passwordHash,
        name: `${dept.name} Dispatcher`,
        email: `${baseUsername}.dispatch@example.com`,
        roles: [UserRole.DISPATCHER],
        departmentId: deptId,
        divisionId: divId,
        isActive: true,
        profileApprovalStatus: 'APPROVED',
        designation: 'Dispatcher',
        staffId: `STAFF-${String(staffCounter++).padStart(3, '0')}`,
        phone: '+91 9000000401',
        firstName: dept.name,
        lastName: 'Dispatcher',
        employmentType: 'Permanent',
        dateOfJoining: new Date('2023-02-15'),
        workLocation: `${dept.name} Dispatch`,
        accountStatus: 'Active',
        personalEmail: `${baseUsername}.dispatch.personal@example.com`,
        address: `${dept.name} Dispatch, Santhigiri`,
        city: 'Thiruvananthapuram',
        postalCode: '695589',
        profileCompletedAt: new Date(),
      },
    });

    const approver = await prisma.user.create({
      data: {
        username: `${baseUsername}.approver`,
        passwordHash,
        name: `${dept.name} Approval Authority`,
        email: `${baseUsername}.approver@example.com`,
        roles: [UserRole.APPROVAL_AUTHORITY],
        departmentId: deptId,
        divisionId: divId,
        isActive: true,
        profileApprovalStatus: 'APPROVED',
        designation: 'Approval Authority',
        staffId: `STAFF-${String(staffCounter++).padStart(3, '0')}`,
        phone: '+91 9000000501',
        firstName: dept.name,
        lastName: 'Approver',
        employmentType: 'Permanent',
        dateOfJoining: new Date('2023-03-01'),
        workLocation: `${dept.name} Office`,
        accountStatus: 'Active',
        personalEmail: `${baseUsername}.approver.personal@example.com`,
        address: `${dept.name} Office, Santhigiri`,
        city: 'Thiruvananthapuram',
        postalCode: '695589',
        profileCompletedAt: new Date(),
      },
    });

    deptUsers.push(admin, sectionOfficer, inwardDesk, dispatcher, approver);
  }

  const allUsers = [superAdmin, ...deptUsers];

  for (const user of allUsers) {
    await prisma.userPoints.create({
      data: {
        userId: user.id,
        basePoints: 1000,
        currentPoints: 1000,
      },
    });
  }
  console.log('✅ Users and UserPoints created');

  // Default Workflow: Inward → Section Officer → Department Admin → Approval Authority → Dispatch → End
  const defaultWorkflow = await prisma.workflow.create({
    data: {
      name: 'Default File Processing Workflow',
      code: 'DEFAULT',
      description: 'Standard workflow: Inward → Section Officer → Department Admin → Approval Authority → Dispatch',
      departmentId: null,
      fileType: null,
      priorityCategory: null,
      createdById: superAdmin.id,
      publishedById: superAdmin.id,
      publishedAt: new Date(),
      isDraft: false,
      isActive: true,
      isPublished: true,
    },
  });

  const startNode = await prisma.workflowNode.create({
    data: {
      workflowId: defaultWorkflow.id,
      nodeId: 'start',
      nodeType: 'start',
      label: 'Start',
      description: 'File enters the system',
      positionX: 100,
      positionY: 100,
    },
  });
  const inwardNode = await prisma.workflowNode.create({
    data: {
      workflowId: defaultWorkflow.id,
      nodeId: 'inward_desk',
      nodeType: 'task',
      label: 'Inward Desk',
      description: 'File received at inward desk',
      assigneeType: 'role',
      assigneeValue: 'INWARD_DESK',
      timeLimit: 24 * 60 * 60,
      timeLimitType: 'business_days',
      availableActions: ['forward', 'return'],
      positionX: 100,
      positionY: 200,
    },
  });
  const sectionNode = await prisma.workflowNode.create({
    data: {
      workflowId: defaultWorkflow.id,
      nodeId: 'section_officer',
      nodeType: 'task',
      label: 'Section Officer',
      description: 'Processing by section officer',
      assigneeType: 'role',
      assigneeValue: 'SECTION_OFFICER',
      timeLimit: 3 * 24 * 60 * 60,
      timeLimitType: 'business_days',
      availableActions: ['forward', 'return', 'request_opinion'],
      positionX: 100,
      positionY: 300,
    },
  });
  const deptAdminNode = await prisma.workflowNode.create({
    data: {
      workflowId: defaultWorkflow.id,
      nodeId: 'dept_admin',
      nodeType: 'task',
      label: 'Department Admin',
      description: 'Review by department admin',
      assigneeType: 'role',
      assigneeValue: 'DEPT_ADMIN',
      timeLimit: 2 * 24 * 60 * 60,
      timeLimitType: 'business_days',
      availableActions: ['forward', 'approve', 'return'],
      positionX: 100,
      positionY: 350,
    },
  });
  const approvalNode = await prisma.workflowNode.create({
    data: {
      workflowId: defaultWorkflow.id,
      nodeId: 'approval',
      nodeType: 'task',
      label: 'Approval Authority',
      description: 'Review and approval',
      assigneeType: 'role',
      assigneeValue: 'APPROVAL_AUTHORITY',
      timeLimit: 2 * 24 * 60 * 60,
      timeLimitType: 'business_days',
      availableActions: ['approve', 'reject', 'return'],
      positionX: 100,
      positionY: 400,
    },
  });
  const dispatchNode = await prisma.workflowNode.create({
    data: {
      workflowId: defaultWorkflow.id,
      nodeId: 'dispatch',
      nodeType: 'task',
      label: 'Dispatch',
      description: 'File ready for dispatch',
      assigneeType: 'role',
      assigneeValue: 'DISPATCHER',
      timeLimit: 24 * 60 * 60,
      timeLimitType: 'business_days',
      availableActions: ['dispatch'],
      positionX: 100,
      positionY: 500,
    },
  });
  const endNode = await prisma.workflowNode.create({
    data: {
      workflowId: defaultWorkflow.id,
      nodeId: 'end',
      nodeType: 'end',
      label: 'End',
      description: 'File processing complete',
      positionX: 100,
      positionY: 600,
    },
  });

  await prisma.workflowEdge.createMany({
    data: [
      { workflowId: defaultWorkflow.id, sourceNodeId: startNode.id, targetNodeId: inwardNode.id, label: 'Start', priority: 1 },
      { workflowId: defaultWorkflow.id, sourceNodeId: inwardNode.id, targetNodeId: sectionNode.id, label: 'Forward', priority: 1 },
      { workflowId: defaultWorkflow.id, sourceNodeId: sectionNode.id, targetNodeId: deptAdminNode.id, label: 'Forward', priority: 1 },
      { workflowId: defaultWorkflow.id, sourceNodeId: deptAdminNode.id, targetNodeId: approvalNode.id, label: 'Forward', priority: 1 },
      { workflowId: defaultWorkflow.id, sourceNodeId: approvalNode.id, targetNodeId: dispatchNode.id, label: 'Approved', priority: 1 },
      { workflowId: defaultWorkflow.id, sourceNodeId: dispatchNode.id, targetNodeId: endNode.id, label: 'Dispatched', priority: 1 },
    ],
  });
  console.log('✅ Default workflow created (Inward → Section Officer → Dept Admin → Approval Authority → Dispatch)');

  // Global system settings
  const setGlobalSetting = async (key: string, value: string, description?: string) => {
    const existing = await prisma.systemSettings.findFirst({
      where: { key, departmentId: null },
    });
    if (existing) {
      await prisma.systemSettings.update({
        where: { id: existing.id },
        data: { value, ...(description != null && { description }) },
      });
    } else {
      await prisma.systemSettings.create({
        data: { key, value, description: description ?? null, departmentId: null },
      });
    }
  };

  // Default SLA norm: 48 hours
  await setGlobalSetting(
    'defaultSlaNormHours',
    '48',
    'Default SLA norm in hours for file due time when desk has no slaNorm (e.g. 48 = 48 hours)',
  );
  console.log('✅ Default SLA norm: 48 hours');

  await setGlobalSetting(
    'ENABLE_DEFAULT_DUE_TIME',
    'true',
    'When true, apply default due time (defaultSlaNormHours) where no desk SLA is set.',
  );
  console.log('✅ ENABLE_DEFAULT_DUE_TIME (global)');

  const sageKeys = [
    { key: 'BUSINESS_START_TIME', value: '09:30', description: 'Business day start (HH:mm). Timer resumes at this time.' },
    { key: 'BUSINESS_END_TIME', value: '17:30', description: 'Business day end (HH:mm). Timer pauses at this time.' },
    { key: 'BUSINESS_HOURS_PER_DAY', value: '8', description: 'Working hours per day (number).' },
    { key: 'OPTIMUM_TIME', value: '10', description: 'Optimum processing time in working hours. File red-listed when elapsed >= this.' },
    { key: 'IN_PROGRESS_PERCENTAGE', value: '25', description: 'Percentage of OPTIMUM_TIME. File is In Progress while elapsed <= (OPTIMUM_TIME * this / 100).' },
  ];
  for (const { key, value, description } of sageKeys) {
    await setGlobalSetting(key, value, description);
  }
  console.log('✅ SAGE global config (business hours, OPTIMUM_TIME, IN_PROGRESS_PERCENTAGE)');

  console.log('🎉 Seed completed successfully!');
  console.log('\n📋 Test Accounts:');
  console.log('  Super Admin: admin / admin123');
  console.log('  Dept users (per department, password123):');
  console.log('    <code>.admin, <code>.section, <code>.inward, <code>.dispatch, <code>.approver');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
