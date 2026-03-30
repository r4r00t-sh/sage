import type { Prisma } from '@prisma/client';

/** Prisma User filter: active user is DEPT_ADMIN for this department (primary or administered). */
export function deptAdminInDepartmentWhere(departmentId: string): Prisma.UserWhereInput {
  return {
    roles: { has: 'DEPT_ADMIN' },
    OR: [
      { departmentId },
      { administeredDepartments: { some: { id: departmentId } } },
    ],
  };
}

/** Prisma User filter: user has `role` for this department (primary or administered). */
export function departmentalRoleInDepartmentWhere(
  role: string,
  departmentId: string,
): Prisma.UserWhereInput {
  return {
    roles: { has: role as any },
    OR: [
      { departmentId },
      { administeredDepartments: { some: { id: departmentId } } },
    ],
  };
}
