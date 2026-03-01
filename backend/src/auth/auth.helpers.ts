/**
 * User shape from JWT (has roles array).
 */
export interface UserWithRoles {
  id?: string;
  roles?: string[];
  departmentId?: string | null;
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
