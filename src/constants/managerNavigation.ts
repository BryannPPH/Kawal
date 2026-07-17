import { ClipboardList, LayoutDashboard, Radio, Users, WalletCards } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ManagerSection } from '../types/navigation';

export type ManagerSectionMeta = {
  section: ManagerSection;
  title: string;
  label: string;
  path: string;
  icon: LucideIcon;
};

export const managerSections = [
  { section: 'dashboard', title: 'Dashboard', label: 'Dashboard', path: '/manager', icon: LayoutDashboard },
  { section: 'workers', title: 'Workers', label: 'Workers', path: '/manager/workers', icon: Users },
  { section: 'tasks', title: 'Tasks', label: 'Tasks', path: '/manager/tasks', icon: ClipboardList },
  { section: 'payroll', title: 'Payroll', label: 'Payroll', path: '/manager/payroll', icon: WalletCards },
  { section: 'iot', title: 'IoT Panel', label: 'IoT Panel', path: '/manager/iot', icon: Radio }
] satisfies ManagerSectionMeta[];

export const managerSectionMeta = managerSections.reduce(
  (sections, section) => {
    sections[section.section] = section;
    return sections;
  },
  {} as Record<ManagerSection, ManagerSectionMeta>
);

export function getManagerSectionFromPath(pathname: string): ManagerSection {
  const section = pathname.split('/')[2];

  if (section === 'incidents') {
    return 'iot';
  }

  const match = managerSections.find((item) => item.section === section);
  return match?.section ?? 'dashboard';
}
