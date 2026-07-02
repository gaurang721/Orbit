/**
 * Pure account-usability check shared by the login flow and the per-request
 * auth guard. Kept dependency-free so both the service and middleware can use
 * it without creating an import cycle.
 */
export interface AccountStatusFields {
  isActive: boolean;
  isBanned: boolean;
  bannedUntil: Date | null;
}

/** Returns a human-readable reason the account can't be used, or null if it's fine. */
export function accountStatusError(user: AccountStatusFields): string | null {
  if (!user.isActive) return 'This account has been deactivated';
  if (user.isBanned && (!user.bannedUntil || user.bannedUntil > new Date())) {
    return 'This account is suspended';
  }
  return null;
}
