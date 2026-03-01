import { PrismaClient, UserRole, FilePriorityCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Santhigiri Ashram structure from EFILE_CLUSTER_TREE.md
// Each entry: [departmentName, departmentCode, divisions[]]
const SANTHIGIRI_STRUCTURE: { name: string; code: string; divisions: string[] }[] = [
  { name: 'Agriculture Department', code: 'AGR', divisions: ['Animal Husbandry Division', 'Office Administration - Agriculture'] },
  { name: 'Arts And Culture Department', code: 'ART', divisions: ['Office Administration - Arts and Culture', 'Santhigiri Grihasthashramasangham', 'Santhigiri Mathrumandalam', 'Santhigiri Santhimahima', 'Santhigiri Viswa Samskrithy Kalarangam', 'Santhigiri Viswasamskarika Navodhana Kendram'] },
  { name: 'Communications Department', code: 'COM', divisions: ['Office Administration - Communications', 'Santhigiri NN Communications', 'Santhigiri Publications Division'] },
  { name: 'Education Department', code: 'EDU', divisions: ['Office Administration - Education', 'Santhigiri Vidyabhavan Higher Secondary School', 'Santhigiri Vidyabhavan Senior Secondary School'] },
  { name: 'Estate And Assets Management Department', code: 'EAM', divisions: ['Office Administration - Estate And Assets Management'] },
  { name: 'Finance Department', code: 'FIN', divisions: ['Accounts', 'Audit', 'Budget Division', 'Office Administration - Finance', 'Payroll', 'Taxation', 'Treasury'] },
  { name: 'General Administration Department', code: 'GAD', divisions: ['Office Administration'] },
  { name: 'Human Resources Department', code: 'HR', divisions: ['Office Administration - Human Resources', 'Santhigiri Institute of Training And Development'] },
  { name: 'Industries Department', code: 'IND', divisions: ['Office Administration - Industries', 'Santhigiri Bhagini Nikethan', 'Santhigiri Madhuram Bakery', 'Santhigiri Mudranalayam', 'Santhigiri Nirmalam Food Products, Chandiroor', 'Santhigiri Pappad, Pampady', 'Santhigiri Sneha Oil Mill, Chandiroor', 'Santhigiri Sukhamtharum Pudava, Healthcare Zone', 'Santhigiri Womens Handloom And Weaving Industry'] },
  { name: 'Law Department', code: 'LAW', divisions: ['Office Administration - Law'] },
  { name: 'Marketing Department', code: 'MKT', divisions: ['Office Administration - Marketing', 'Santhigiri E-commerce', 'Santhigiri Fuels', 'Santhigiri Healthcare Products - Marketing', 'Santhigiri Shopping Mall', 'Santhigiri Vegetable Stall And Food Services', 'Shops And Establishments'] },
  { name: 'Materials Management Department', code: 'MMT', divisions: ['Office Administration - Materials Management', 'Purchase Division'] },
  { name: 'Office Of The General Secretary', code: 'OGS', divisions: ['Administration - Office Of The General Secretary', 'Ashram Branches Coordination', 'Celebrations', 'Facility Management Division', 'Health & Family Welfare Division', 'Janmagriham ( Santhigiri Ashram, Chandiroor Branch )', 'Project Division', 'Public Relations Division', 'Santhigiri Ashram, Alappuzha Area Office', 'Santhigiri Ashram, Andarkottaram Branch', 'Santhigiri Ashram, Bengaluru Regional Office', 'Santhigiri Ashram, Chennai Regional Office', 'Santhigiri Ashram, Cherthala Area Office', 'Santhigiri Ashram, Cheyyur Branch', 'Santhigiri Ashram, ERNAKULAM Area Office', 'Santhigiri Ashram, Guwahati Regional Office', 'Santhigiri Ashram, Harippad Area Office', 'Santhigiri Ashram, Harippad Branch', 'Santhigiri Ashram, Kakkodi Branch', 'Santhigiri Ashram, Kannur Area Office', 'Santhigiri Ashram, Kanyakumari Branch', 'Santhigiri Ashram, Kollam Area Office ( City )', 'Santhigiri Ashram, Kottarakakra Area Office', 'Santhigiri Ashram, Kottayam Area Office', 'Santhigiri Ashram, Koyilandi Area Office', 'Santhigiri Ashram, Kumali Area Office', 'Santhigiri Ashram, Madurai Regional Office', 'Santhigiri Ashram, Malappuram Area Office', 'Santhigiri Ashram, New Delhi Zonal Office', 'Santhigiri Ashram, Olasseri Branch', 'Santhigiri Ashram, Palakkad Area Office', 'Santhigiri Ashram, Palarivattam Branch', 'Santhigiri Ashram, Pampady Branch', 'Santhigiri Ashram, Pathanamthitta Area Office', 'Santhigiri Ashram, Polayathode Branch', 'Santhigiri Ashram, Saket Branch', 'Santhigiri Ashram, Sarjapur Road Branch', 'Santhigiri Ashram, Sulthan Bathery Branch', 'Santhigiri Ashram, Thalassery Area Office', 'Santhigiri Ashram, Thambakachuvadu Branch', 'Santhigiri Ashram, Thangalur Branch', 'Santhigiri Ashram, Thiruvananthapuram Area Office (rural)', 'Santhigiri Ashram, Thookupalam Area Office', 'Santhigiri Ashram, Thrissur Area Office', 'Santhigiri Ashram, Vadakara Area Office', 'Santhigiri Ashram, Vaikom Area Office', 'Santhigiri Ashram, Vaikom Branch', 'Santhigiri Ashram, Valliyayi Branch', 'Santhigiri Ashram, Waynad Area Office', 'Santhigiri Athmavidyalayam', 'Santhigiri Information Technology', 'Santhigiri Inn', 'Strategic Management', 'Technical Advisory Cell', 'Vehicles And Transportation', 'Welfare Divison', 'Working Womens Hostel, Palarivattom'] },
  { name: 'Office Of The President', code: 'OOP', divisions: ['Administration - Office Of The President'] },
  { name: 'Operations Department', code: 'OPS', divisions: ['Civil Projects Monitoring Division', 'Community Kitchen', 'Computer Services', 'Electrical And Utilities', 'House Keeping And Sanitation', 'Maintenance Division', 'Office Administration - Operations', 'Project Execution'] },
  { name: 'Planning And Development Department', code: 'PND', divisions: ['Planning Division'] },
  { name: 'Quality Assurance Department', code: 'QAS', divisions: ['Office Administration - Quality Assurance'] },
  { name: 'Safety Department', code: 'SAF', divisions: ['Office Administration - Safety'] },
  { name: 'Santhigiri Healthcare And Research Organization', code: 'SHRO', divisions: ['Medical Education Division', 'Office - Santhigiri Medical Services Division', 'Office Administration - SHRO', 'S A S H C, Kunnumpuram Road', 'S A S H C, Pattom', 'S A S H C, Vivekanandapuram', 'S A S H, Ahmedabad', 'S A S H, Anna Nagar', 'S A S H, Bhiwadi, Rajasthan', 'S A S H, East Nadakkavu', 'S A S H, Ernakulam South', 'S A S H, H S R Layout, Bengaluru', 'S A S H, Kadapa', 'S A S H, Kakkanad', 'S A S H, Kottayam', 'S A S H, Kumali', 'S A S H, Madurai', 'S A S H, Panjagutta', 'S A S H, Puduchery', 'S A S H, Royapettah', 'S A S H, Saibaba Colony', 'S A S H, Uzhavoor', 'S A S H, Visakhapatnam', 'S A S V - 1', 'S A S V - O P Clinic, P M Taj Road', 'S A S V - O P Clinic, Pothencode', 'Santhigiri Allopathy Pharmacy', 'Santhigiri Angadi Stores, Pothencode', 'Santhigiri Ashram, Hyderabad Regional Office', 'Santhigiri Ashram, Thiruvananthapuram Area Office (city)', 'Santhigiri Ayurveda And Siddha Hospital, Guwahati', 'Santhigiri Ayurveda And Siddha Hospital, Polayathode', 'Santhigiri Ayurveda And Siddha Hospital, Saket', 'Santhigiri Ayurveda And Siddha Hospital, Tiruchirappally', 'Santhigiri Ayurveda And Siddha Hospital, Udayanagar', 'Santhigiri Ayurveda And Siddha Hospital, Vellayambalam', 'Santhigiri Ayurveda And Siddha Vaidyasala', 'Santhigiri Ayurveda Hospital And Research Institute', 'Santhigiri Ayurveda Medical College', 'Santhigiri Ayurveda Medical College Canteen, Olasseri', 'Santhigiri Ayurveda Medical College Hospital', 'Santhigiri Ayurveda Medical College Hospital O P Clinic, Puthuppally Theruvu', 'Santhigiri Ayurveda Medical College Students Store', 'Santhigiri Ayurveda Siddha Pharmacy', 'Santhigiri Dental Clinic', 'Santhigiri Healthcare Products Division', 'Santhigiri Herbal Soaps', 'Santhigiri Homeo Pharmacy', 'Santhigiri Institute Of Para-medical Sciences', 'Santhigiri Labs & Scans', 'Santhigiri Medical Services Division', 'Santhigiri Siddha Medical College', 'Santhigiri Siddha Medical College Hospital', 'Warehouse 2- Healthcare Zone'] },
  { name: 'Santhigiri Research Foundation', code: 'SRF', divisions: ['Santhigiri Scientific and Industrial Research Institute', 'Santhigiri Social Research Institute'] },
  { name: 'Security Department', code: 'SEC', divisions: ['Office Administration - Security'] },
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

  // --- Cleanup: remove mock data and old structure ---
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

  // Create Organisation
  const org = await prisma.organisation.create({
    data: {
      id: 'org-santhigiri-001',
      name: 'Santhigiri Ashram',
    },
  });
  console.log('✅ Organisation:', org.name);

  // Create Departments and Divisions
  const departmentIds = new Map<string, string>();
  const divisionIdsByDept = new Map<string, string[]>();

  for (const dept of SANTHIGIRI_STRUCTURE) {
    const created = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, organisationId: org.id },
      create: {
        name: dept.name,
        code: dept.code,
        organisationId: org.id,
      },
    });
    departmentIds.set(dept.code, created.id);
    const divIds: string[] = [];

    for (let i = 0; i < dept.divisions.length; i++) {
      const divName = dept.divisions[i];
      const code = divisionCode(divName, i);
      const divCode = `${dept.code}-${code}`;
      // Check if division already exists by name and department
      const existing = await prisma.division.findFirst({
        where: {
          name: divName,
          departmentId: created.id,
        },
      });
      
      let div;
      if (existing) {
        // Update existing division
        div = await prisma.division.update({
          where: { id: existing.id },
          data: {
            name: divName,
            code: divCode,
            departmentId: created.id,
          },
        });
      } else {
        // Create new division
        div = await prisma.division.create({
          data: {
            name: divName,
            code: divCode,
            departmentId: created.id,
          },
        });
      }
      divIds.push(div.id);
    }
    divisionIdsByDept.set(dept.code, divIds);
  }
  console.log('✅ Departments created:', SANTHIGIRI_STRUCTURE.length);
  const totalDivisions = [...divisionIdsByDept.values()].reduce((s, a) => s + a.length, 0);
  console.log('✅ Divisions created:', totalDivisions);

  const passwordHash = await bcrypt.hash('password123', 10);
  const finDeptId = departmentIds.get('FIN')!;
  const finFirstDivisionId = divisionIdsByDept.get('FIN')![0];

  // Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      name: 'Super Administrator',
      email: 'admin@santhigiri.org',
      roles: [UserRole.SUPER_ADMIN],
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Super Administrator',
      staffId: 'STAFF-001',
      phone: '+91 9876543001',
      firstName: 'Super',
      lastName: 'Administrator',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2022-01-01'),
      workLocation: 'Head Office',
      accountStatus: 'Active',
      bio: 'System super administrator for testing.',
    },
  });
  console.log('✅ Super Admin:', superAdmin.username);

  // Developer (god-level, no department)
  const developer = await prisma.user.upsert({
    where: { username: 'keerthanan' },
    update: {
      name: 'keerthanan',
      email: 'keerthananps88@gmail.com',
      passwordHash: await bcrypt.hash('K33rth4n4n@588$', 10),
      roles: [UserRole.DEVELOPER],
      departmentId: null,
      divisionId: null,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Software Developer',
      staffId: 'STAFF-DEV',
      phone: '+91 9876543000',
      firstName: 'Keerthanan',
      lastName: 'P S',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      workLocation: 'Head Office',
      accountStatus: 'Active',
      bio: 'Developer account for testing.',
    },
    create: {
      username: 'keerthanan',
      name: 'keerthanan',
      email: 'keerthananps88@gmail.com',
      passwordHash: await bcrypt.hash('K33rth4n4n@588$', 10),
      roles: [UserRole.DEVELOPER],
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Software Developer',
      staffId: 'STAFF-DEV',
      phone: '+91 9876543000',
      firstName: 'Keerthanan',
      lastName: 'P S',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      workLocation: 'Head Office',
      accountStatus: 'Active',
      bio: 'Developer account for testing.',
    },
  });
  console.log('✅ Developer:', developer.username);

  // Finance Department users (for initial workflow use)
  const finDeptAdmin = await prisma.user.create({
    data: {
      username: 'fin.admin',
      passwordHash,
      name: 'Finance Department Admin',
      email: 'fin.admin@santhigiri.org',
      roles: [UserRole.DEPT_ADMIN],
      departmentId: finDeptId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Department Admin',
      staffId: 'STAFF-002',
      phone: '+91 9876543002',
      firstName: 'Finance',
      lastName: 'Admin',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2023-06-01'),
      workLocation: 'Finance Block',
      accountStatus: 'Active',
      bio: 'Finance department administrator for testing.',
    },
  });

  const sectionOfficer = await prisma.user.create({
    data: {
      username: 'fin.accounts',
      passwordHash,
      name: 'Accounts Section Officer',
      email: 'fin.accounts@santhigiri.org',
      roles: [UserRole.SECTION_OFFICER],
      departmentId: finDeptId,
      divisionId: finFirstDivisionId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Section Officer',
      staffId: 'STAFF-003',
      phone: '+91 9876543003',
      firstName: 'Accounts',
      lastName: 'Section Officer',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2023-07-01'),
      workLocation: 'Finance - Accounts Division',
      accountStatus: 'Active',
      bio: 'Accounts section officer for testing.',
    },
  });

  const inwardDesk = await prisma.user.create({
    data: {
      username: 'fin.inward',
      passwordHash,
      name: 'Finance Inward Desk',
      email: 'fin.inward@santhigiri.org',
      roles: [UserRole.INWARD_DESK],
      departmentId: finDeptId,
      divisionId: finFirstDivisionId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Inward Desk',
      staffId: 'STAFF-004',
      phone: '+91 9876543004',
      firstName: 'Finance',
      lastName: 'Inward Desk',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2023-08-01'),
      workLocation: 'Finance - Inward',
      accountStatus: 'Active',
      bio: 'Finance inward desk for testing.',
    },
  });

  const dispatcher = await prisma.user.create({
    data: {
      username: 'fin.dispatch',
      passwordHash,
      name: 'Finance Dispatcher',
      email: 'fin.dispatch@santhigiri.org',
      roles: [UserRole.DISPATCHER],
      departmentId: finDeptId,
      divisionId: finFirstDivisionId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Dispatcher',
      staffId: 'STAFF-005',
      phone: '+91 9876543005',
      firstName: 'Finance',
      lastName: 'Dispatcher',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2023-08-15'),
      workLocation: 'Finance - Dispatch',
      accountStatus: 'Active',
      bio: 'Finance dispatcher for testing.',
    },
  });

  const approvalAuth = await prisma.user.create({
    data: {
      username: 'fin.approver',
      passwordHash,
      name: 'Finance Approval Authority',
      email: 'fin.approver@santhigiri.org',
      roles: [UserRole.APPROVAL_AUTHORITY],
      departmentId: finDeptId,
      divisionId: finFirstDivisionId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Approval Authority',
      staffId: 'STAFF-006',
      phone: '+91 9876543006',
      firstName: 'Finance',
      lastName: 'Approval Authority',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2023-05-01'),
      workLocation: 'Finance Block',
      accountStatus: 'Active',
      bio: 'Finance approval authority for testing.',
    },
  });

  const clerk = await prisma.user.create({
    data: {
      username: 'fin.clerk',
      passwordHash,
      name: 'Finance Clerk',
      email: 'fin.clerk@santhigiri.org',
      roles: [UserRole.USER],
      departmentId: finDeptId,
      divisionId: finFirstDivisionId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Clerk',
      staffId: 'STAFF-007',
      phone: '+91 9876543007',
      firstName: 'Finance',
      lastName: 'Clerk',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2024-01-01'),
      workLocation: 'Finance - Accounts Division',
      accountStatus: 'Active',
      bio: 'Finance clerk for testing.',
    },
  });

  const chatManager = await prisma.user.create({
    data: {
      username: 'fin.chat',
      passwordHash,
      name: 'Finance Chat Manager',
      email: 'fin.chat@santhigiri.org',
      roles: [UserRole.CHAT_MANAGER],
      departmentId: finDeptId,
      divisionId: finFirstDivisionId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Chat Manager',
      staffId: 'STAFF-008',
      phone: '+91 9876543008',
      firstName: 'Finance',
      lastName: 'Chat Manager',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2023-09-01'),
      workLocation: 'Finance Block',
      accountStatus: 'Active',
      bio: 'Finance chat manager for testing.',
    },
  });

  // Operations Department users (ops.admin is created in the per-department loop below)
  const opsDeptId = departmentIds.get('OPS')!;
  const opsFirstDivisionId = divisionIdsByDept.get('OPS')![0];
  const opsSectionOfficer = await prisma.user.create({
    data: {
      username: 'ops.office',
      passwordHash,
      name: 'Operations Section Officer',
      email: 'ops.office@santhigiri.org',
      roles: [UserRole.SECTION_OFFICER],
      departmentId: opsDeptId,
      divisionId: opsFirstDivisionId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Section Officer',
      staffId: 'STAFF-009',
      phone: '+91 9876543009',
      firstName: 'Operations',
      lastName: 'Section Officer',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2023-07-15'),
      workLocation: 'Operations Block',
      accountStatus: 'Active',
      bio: 'Operations section officer for testing.',
    },
  });
  const opsInward = await prisma.user.create({
    data: {
      username: 'ops.inward',
      passwordHash,
      name: 'Operations Inward Desk',
      email: 'ops.inward@santhigiri.org',
      roles: [UserRole.INWARD_DESK],
      departmentId: opsDeptId,
      divisionId: opsFirstDivisionId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Inward Desk',
      staffId: 'STAFF-010',
      phone: '+91 9876543010',
      firstName: 'Operations',
      lastName: 'Inward Desk',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2023-09-01'),
      workLocation: 'Operations - Inward',
      accountStatus: 'Active',
      bio: 'Operations inward desk for testing.',
    },
  });
  const opsDispatcher = await prisma.user.create({
    data: {
      username: 'ops.dispatch',
      passwordHash,
      name: 'Operations Dispatcher',
      email: 'ops.dispatch@santhigiri.org',
      roles: [UserRole.DISPATCHER],
      departmentId: opsDeptId,
      divisionId: opsFirstDivisionId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Dispatcher',
      staffId: 'STAFF-011',
      phone: '+91 9876543011',
      firstName: 'Operations',
      lastName: 'Dispatcher',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2023-10-01'),
      workLocation: 'Operations - Dispatch',
      accountStatus: 'Active',
      bio: 'Operations dispatcher for testing.',
    },
  });
  const opsApprover = await prisma.user.create({
    data: {
      username: 'ops.approver',
      passwordHash,
      name: 'Operations Approval Authority',
      email: 'ops.approver@santhigiri.org',
      roles: [UserRole.APPROVAL_AUTHORITY],
      departmentId: opsDeptId,
      divisionId: opsFirstDivisionId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Approval Authority',
      staffId: 'STAFF-012',
      phone: '+91 9876543012',
      firstName: 'Operations',
      lastName: 'Approval Authority',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2023-05-15'),
      workLocation: 'Operations Block',
      accountStatus: 'Active',
      bio: 'Operations approval authority for testing.',
    },
  });
  const opsClerk = await prisma.user.create({
    data: {
      username: 'ops.clerk',
      passwordHash,
      name: 'Operations Clerk',
      email: 'ops.clerk@santhigiri.org',
      roles: [UserRole.USER],
      departmentId: opsDeptId,
      divisionId: opsFirstDivisionId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Clerk',
      staffId: 'STAFF-013',
      phone: '+91 9876543013',
      firstName: 'Operations',
      lastName: 'Clerk',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2024-02-01'),
      workLocation: 'Operations Block',
      accountStatus: 'Active',
      bio: 'Operations clerk for testing.',
    },
  });
  const opsChatManager = await prisma.user.create({
    data: {
      username: 'ops.chat',
      passwordHash,
      name: 'Operations Chat Manager',
      email: 'ops.chat@santhigiri.org',
      roles: [UserRole.CHAT_MANAGER],
      departmentId: opsDeptId,
      divisionId: opsFirstDivisionId,
      isActive: true,
      profileApprovalStatus: 'APPROVED',
      designation: 'Chat Manager',
      staffId: 'STAFF-014',
      phone: '+91 9876543014',
      firstName: 'Operations',
      lastName: 'Chat Manager',
      profileCompletedAt: new Date(),
      employmentType: 'Permanent',
      dateOfJoining: new Date('2023-11-01'),
      workLocation: 'Operations Block',
      accountStatus: 'Active',
      bio: 'Operations chat manager for testing.',
    },
  });

  // finDeptAdmin also gets a division
  await prisma.user.update({
    where: { id: finDeptAdmin.id },
    data: { divisionId: finFirstDivisionId },
  });

  // One Dept Admin per department (other than Finance); each in a department and division
  const otherAdmins: Awaited<ReturnType<typeof prisma.user.create>>[] = [];
  const otherDeptCodes = SANTHIGIRI_STRUCTURE.filter((d) => d.code !== 'FIN');
  for (let idx = 0; idx < otherDeptCodes.length; idx++) {
    const { code, name } = otherDeptCodes[idx];
    const deptId = departmentIds.get(code)!;
    const firstDivId = divisionIdsByDept.get(code)?.[0];
    const safeUsername = code.toLowerCase().replace(/[^a-z0-9]/g, '.');
    const shortName = name.replace(' Department', '').trim();
    const user = await prisma.user.create({
      data: {
        username: `${safeUsername}.admin`,
        passwordHash,
        name: `${shortName} Admin`,
        email: `${safeUsername}.admin@santhigiri.org`,
        roles: [UserRole.DEPT_ADMIN],
        departmentId: deptId,
        divisionId: firstDivId ?? undefined,
        isActive: true,
        profileApprovalStatus: 'APPROVED',
        designation: 'Department Admin',
        staffId: `STAFF-${code}-001`,
        phone: `+91 9876543${String(idx + 15).padStart(3, '0')}`,
        firstName: shortName,
        lastName: 'Admin',
        profileCompletedAt: new Date(),
        employmentType: 'Permanent',
        dateOfJoining: new Date('2023-06-01'),
        workLocation: `${shortName} Block`,
        accountStatus: 'Active',
        bio: `${shortName} department administrator for testing.`,
      },
    });
    otherAdmins.push(user);
  }

  const allUsers = [
    superAdmin,
    finDeptAdmin,
    sectionOfficer,
    inwardDesk,
    dispatcher,
    approvalAuth,
    clerk,
    chatManager,
    opsSectionOfficer,
    opsInward,
    opsDispatcher,
    opsApprover,
    opsClerk,
    opsChatManager,
  ];

  for (const user of [...allUsers, ...otherAdmins]) {
    await prisma.userPoints.create({
      data: {
        userId: user.id,
        basePoints: 1000,
        currentPoints: 1000,
      },
    });
  }
  console.log('✅ Users and UserPoints created');

  // Default Workflow
  const defaultWorkflow = await prisma.workflow.create({
    data: {
      name: 'Default File Processing Workflow',
      code: 'DEFAULT',
      description: 'Standard workflow for file processing: Inward → Section Officer → Approval → Dispatch',
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
      { workflowId: defaultWorkflow.id, sourceNodeId: sectionNode.id, targetNodeId: approvalNode.id, label: 'Forward', priority: 1 },
      { workflowId: defaultWorkflow.id, sourceNodeId: approvalNode.id, targetNodeId: dispatchNode.id, label: 'Approved', priority: 1 },
      { workflowId: defaultWorkflow.id, sourceNodeId: dispatchNode.id, targetNodeId: endNode.id, label: 'Dispatched', priority: 1 },
    ],
  });
  console.log('✅ Default workflow created');

  // Default SLA norm: 48 hours (used when a desk has no slaNorm set)
  await prisma.systemSettings.upsert({
    where: { key: 'defaultSlaNormHours' },
    create: {
      key: 'defaultSlaNormHours',
      value: '48',
      description: 'Default SLA norm in hours for file due time when desk has no slaNorm (e.g. 48 = 48 hours)',
    },
    update: { value: '48' },
  });
  console.log('✅ Default SLA norm: 48 hours');

  // SAGE Req 1: Global config (Super Admin) – business hours & status thresholds
  const sageKeys = [
    { key: 'BUSINESS_START_TIME', value: '09:30', description: 'Business day start (HH:mm). Timer resumes at this time.' },
    { key: 'BUSINESS_END_TIME', value: '17:30', description: 'Business day end (HH:mm). Timer pauses at this time.' },
    { key: 'BUSINESS_HOURS_PER_DAY', value: '8', description: 'Working hours per day (number).' },
    { key: 'OPTIMUM_TIME', value: '10', description: 'Optimum processing time in working hours. File red-listed when elapsed >= this.' },
    { key: 'IN_PROGRESS_PERCENTAGE', value: '25', description: 'Percentage of OPTIMUM_TIME. File is In Progress while elapsed <= (OPTIMUM_TIME * this / 100).' },
  ];
  for (const { key, value, description } of sageKeys) {
    await prisma.systemSettings.upsert({
      where: { key },
      create: { key, value, description },
      update: { value, description },
    });
  }
  console.log('✅ SAGE global config (business hours, OPTIMUM_TIME, IN_PROGRESS_PERCENTAGE)');

  console.log('🎉 Seed completed successfully!');
  console.log('\n📋 Test Accounts (password123 except Super Admin):');
  console.log('  Super Admin:        admin / admin123');
  console.log('  Finance Dept Admin: fin.admin / password123');
  console.log('  Section Officer:    fin.accounts / password123');
  console.log('  Inward Desk:        fin.inward / password123');
  console.log('  Dispatcher:         fin.dispatch / password123');
  console.log('  Approval Authority: fin.approver / password123');
  console.log('  Clerk:              fin.clerk / password123');
  console.log('  Chat Manager:       fin.chat / password123');
  console.log('  Operations Dept Admin: ops.admin / password123');
  console.log('  Operations Section Officer: ops.office / password123');
  console.log('  Operations Inward:  ops.inward / password123');
  console.log('  Other dept admins:  <code>.admin (e.g. agr.admin, hr.admin) / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
