import type { AppRole } from "@/hooks/useAuth";

/** Roles considered "admin" (full access). */
export const ADMIN_ROLES: AppRole[] = ["super_admin"];

/** Roles allowed to view financial accounts / balances. */
export const ACCOUNTS_ROLES: AppRole[] = ["super_admin", "accountant", "branch_manager"];

/** Roles allowed to view Personal Expenses. */
export const PERSONAL_EXPENSE_ROLES: AppRole[] = ["super_admin"];

/** Roles considered "staff" (limited access). */
export const STAFF_ROLES: AppRole[] = ["staff"];

export function isAdmin(roles: AppRole[]): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

export function canSeeAccounts(roles: AppRole[]): boolean {
  return roles.some((r) => ACCOUNTS_ROLES.includes(r));
}

export function canSeePersonal(roles: AppRole[]): boolean {
  return roles.some((r) => PERSONAL_EXPENSE_ROLES.includes(r));
}
