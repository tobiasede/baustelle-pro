/**
 * Utility functions for role normalization and validation
 */

export type AppRole = 'HOST' | 'GF' | 'BAULEITER';

/**
 * Normalize role value - never return empty string
 * Maps null, undefined, empty string to undefined
 */
export function normalizeRole(value: string | null | undefined): AppRole | undefined {
  if (!value || value.trim() === '') {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === 'HOST' || normalized === 'GF' || normalized === 'BAULEITER') {
    return normalized as AppRole;
  }
  return undefined;
}

/**
 * Check if role is admin (HOST or GF)
 */
export function isAdminRole(role: AppRole | undefined | null): boolean {
  return role === 'HOST' || role === 'GF';
}

/**
 * Check if role is BAULEITER
 */
export function isBauleiterRole(role: AppRole | undefined | null): boolean {
  return role === 'BAULEITER';
}

/**
 * Get display label for role
 */
export function getRoleLabel(role: AppRole | undefined | null): string {
  switch (role) {
    case 'HOST':
      return 'Administrator';
    case 'GF':
      return 'Geschäftsführer';
    case 'BAULEITER':
      return 'Bauleiter';
    default:
      return 'Laden...';
  }
}
