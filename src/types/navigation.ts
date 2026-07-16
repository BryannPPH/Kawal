export type RouteName = 'login' | 'manager' | 'worker';

export type ManagerSection = 'dashboard' | 'workers' | 'tasks' | 'payroll' | 'iot' | 'incidents';

export type UserRole = 'manager' | 'worker';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};
