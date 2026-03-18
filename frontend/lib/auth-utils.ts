/**
 * User may have `roles: string[]` (new) or legacy `role: string`.
 * Use these helpers so both shapes work.
 */
export function getRoles(user: { roles?: string[]; role?: string } | null | undefined): string[] {
  if (!user) return [];
  if (user.roles?.length) return user.roles;
  if (user.role) return [user.role];
  return [];
}

export function hasRole(user: { roles?: string[]; role?: string } | null | undefined, role: string): boolean {
  return getRoles(user).includes(role);
}

export function hasAnyRole(user: { roles?: string[]; role?: string } | null | undefined, roles: string[]): boolean {
  const userRoles = getRoles(user);
  return roles.some((r) => userRoles.includes(r));
}

/** God-level: developer or super admin (full app access). */
export function hasGodRole(user: { roles?: string[]; role?: string } | null | undefined): boolean {
  return hasAnyRole(user, ['DEVELOPER', 'SUPER_ADMIN']);
}

/** Inward Desk and Dispatcher can only view inbox and forward; they cannot create files. */
export function canCreateFiles(user: { roles?: string[]; role?: string } | null | undefined): boolean {
  if (!user) return false;
  const roles = getRoles(user);
  if (hasAnyRole(user, ['DEVELOPER', 'SUPER_ADMIN', 'DEPT_ADMIN'])) return true;
  if (roles.includes('INWARD_DESK') || roles.includes('DISPATCHER')) return false;
  return true;
}
