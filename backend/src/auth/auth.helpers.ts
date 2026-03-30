/**
 * User shape from JWT (has roles array).
 */
export interface UserWithRoles {
  id?: string;
  roles?: string[];
  departmentId?: string | null;
  administeredDepartments?: { id: string }[];
}

/**
 * Departments managed by departmental privileged roles.
 * Uses explicit M2M if set, else falls back to primary `departmentId`.
 */
export function getDepartmentalScopeDepartmentIds(
  user: UserWithRoles | null | undefined,
): string[] {
  if (!user?.roles?.length) return [];
  const hasDepartmentalScopeRole =
    user.roles.includes('DEPT_ADMIN') || user.roles.includes('APPROVAL_AUTHORITY');
  if (!hasDepartmentalScopeRole) return [];
  const fromM2m = (user.administeredDepartments ?? []).map((d) => d.id);
  if (fromM2m.length > 0) return fromM2m;
  if (user.departmentId) return [user.departmentId];
  return [];
}

/** Backward-compatible alias used by existing DEPT_ADMIN-specific call sites. */
export function getDeptAdminDepartmentIds(user: UserWithRoles | null | undefined): string[] {
  return getDepartmentalScopeDepartmentIds(user);
}

export function hasRole(user: UserWithRoles | null | undefined, role: string): boolean {
  if (!user?.roles?.length) return false;
  return user.roles.includes(role);
}

export function hasAnyRole(user: UserWithRoles | null | undefined, roles: string[]): boolean {
  if (!user?.roles?.length || !roles?.length) return false;
  return roles.some((r) => user.roles!.includes(r));
}

/** God-level: developer or super admin (full app access, no dept restriction). */
export function hasGodRole(user: UserWithRoles | null | undefined): boolean {
  return hasAnyRole(user, ['DEVELOPER', 'SUPER_ADMIN']);
}
