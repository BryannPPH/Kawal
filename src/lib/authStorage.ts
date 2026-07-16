import type { AuthUser, UserRole } from '../types/navigation';

const authRoleStorageKey = 'garudie-auth-role';
const authUserStorageKey = 'garudie-auth-user';

export function getStoredRole(): UserRole | null {
  const role = localStorage.getItem(authRoleStorageKey);
  return role === 'manager' || role === 'worker' || role === 'hse' || role === 'foreman' ? role : null;
}

export function getStoredUser(): AuthUser | null {
  const value = localStorage.getItem(authUserStorageKey);

  if (!value) {
    return null;
  }

  try {
    const user = JSON.parse(value) as AuthUser;
    return user?.id && user?.email && user?.name && user?.role ? user : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(user: AuthUser) {
  localStorage.setItem(authRoleStorageKey, user.role);
  localStorage.setItem(authUserStorageKey, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(authRoleStorageKey);
  localStorage.removeItem(authUserStorageKey);
}
