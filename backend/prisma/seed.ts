import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type EfileClusterEntry = { name: string; divisions: string[] };

/** Stable short codes for departments (must match parsed order). */
const DEPARTMENT_CODES = [
  'AGR',
  'ART',
  'COM',
  'EDU',
  'EAM',
  'FIN',
  'GAD',
  'HR',
  'IND',
  'LAW',
  'MKT',
  'MMO',
  'OGS',
  'OOP',
  'OPD',
  'PND',
  'QAD',
  'SAF',
  'SHR',
  'SRF',
  'SEC',
] as const;

function parseEfileClusterTree(md: string): EfileClusterEntry[] {
  const lines = md.split('\n');
  const out: EfileClusterEntry[] = [];
  let current: EfileClusterEntry | null = null;

  for (const line of lines) {
    const deptMatch = line.match(/^\s{4}[├└]───(.+)$/);
    if (deptMatch) {
      current = { name: deptMatch[1].trim(), divisions: [] };
      out.push(current);
      continue;
    }
    let divMatch = line.match(/^\s{4}│\s+[├└]───(.+)$/);
    if (!divMatch) divMatch = line.match(/^\s{8}[├└]───(.+)$/);
    if (divMatch && current) {
      current.divisions.push(divMatch[1].trim());
    }
  }

  return out;
}

function loadEfileClusterFromRepo(): EfileClusterEntry[] {
  const candidates = [
    join(__dirname, '../../EFILE_CLUSTER_TREE.md'), // local: repo root from backend/prisma
    join(__dirname, '../EFILE_CLUSTER_TREE.md'), // Docker image: /app/EFILE_CLUSTER_TREE.md from prisma/
  ];
  for (const treePath of candidates) {
    if (existsSync(treePath)) {
      const md = readFileSync(treePath, 'utf8');
      return parseEfileClusterTree(md);
    }
  }
  throw new Error(`EFILE_CLUSTER_TREE.md not found. Tried:\n  ${candidates.join('\n  ')}`);
}

async function main() {
  console.log('🌱 Starting seed...');

  const cluster = loadEfileClusterFromRepo();
  if (cluster.length !== DEPARTMENT_CODES.length) {
    throw new Error(
      `EFILE cluster parse: expected ${DEPARTMENT_CODES.length} departments, got ${cluster.length}. Update DEPARTMENT_CODES or the tree file.`,
    );
  }

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

  let divisionCount = 0;
  for (let i = 0; i < cluster.length; i++) {
    const entry = cluster[i];
    const code = DEPARTMENT_CODES[i];
    const createdDept = await prisma.department.create({
      data: {
        name: entry.name,
        code,
        organisationId: org.id,
      },
    });

    for (let j = 0; j < entry.divisions.length; j++) {
      const divCode = `${code}-D${String(j + 1).padStart(3, '0')}`;
      await prisma.division.create({
        data: {
          name: entry.divisions[j],
          code: divCode,
          departmentId: createdDept.id,
        },
      });
      divisionCount++;
    }
  }

  console.log('✅ Departments created:', cluster.length);
  console.log('✅ Divisions created:', divisionCount);

  // Super Admin only (no department)
  const superAdmin = await prisma.user.create({
    data: {
      username: 'super.admin',
      passwordHash: await bcrypt.hash('Sup3r.4dm!n@s4nthigiri', 10),
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

  await prisma.userPoints.create({
    data: {
      userId: superAdmin.id,
      basePoints: 1000,
      currentPoints: 1000,
    },
  });
  console.log('✅ UserPoints for Super Admin');

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
  console.log('\n📋 Login: Super Admin — username: super.admin / password: Sup3r.4dm!n@s4nthigiri');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
