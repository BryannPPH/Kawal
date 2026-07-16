import type { Notification, Task, Tone, Worker, WorkerStatus } from '../types/workforce';

export const workers: Worker[] = [
  {
    id: 'budi',
    name: 'Budi Santoso',
    role: 'Steel Crew',
    task: 'Install steel beam',
    status: 'working',
    zone: 'Zone C',
    time: '02:14',
    workload: 'Balanced',
    fatigue: 24,
    pay: 'Rp180.000',
    match: 94
  },
  {
    id: 'ag',
    name: 'Agus Pratama',
    role: 'Crane Signal',
    task: 'Crane signal check',
    status: 'working',
    zone: 'Zone B',
    time: '01:42',
    workload: 'Medium',
    fatigue: 36,
    pay: 'Rp150.000',
    match: 88
  },
  {
    id: 'rizky',
    name: 'Rizky Maulana',
    role: 'General Crew',
    task: 'Awaiting steel crew',
    status: 'waiting',
    zone: 'Gate 2',
    time: '00:00',
    workload: 'Low',
    fatigue: 12,
    pay: 'Rp95.000',
    match: 81
  },
  {
    id: 'dewi',
    name: 'Dewi Lestari',
    role: 'Safety Support',
    task: 'Ready near Zone B',
    status: 'waiting',
    zone: 'Zone B',
    time: '00:00',
    workload: 'Low',
    fatigue: 18,
    pay: 'Rp120.000',
    match: 84
  },
  {
    id: 'sari',
    name: 'Sari Ningsih',
    role: 'Scaffold Crew',
    task: 'Mandatory break',
    status: 'break',
    zone: 'Rest Area',
    time: '00:12',
    workload: 'Medium',
    fatigue: 58,
    pay: 'Rp145.000',
    match: 76
  },
  {
    id: 'dimas',
    name: 'Dimas Ardi',
    role: 'Inspector',
    task: 'Scaffold inspection',
    status: 'done',
    zone: 'Zone A',
    time: '03:20',
    workload: 'High',
    fatigue: 44,
    pay: 'Rp210.000',
    match: 89
  }
];

export const tasks: Task[] = [
  { title: 'Steel beam install', owner: 'Budi Santoso', status: 'In progress', due: '2h 15m', tone: 'warning' },
  { title: 'Harness audit', owner: 'Dewi Lestari', status: 'Assigned', due: '45m', tone: 'neutral' },
  { title: 'Scaffold photo proof', owner: 'Dimas Ardi', status: 'Review', due: 'Ready', tone: 'success' },
  { title: 'Wet surface cleanup', owner: 'Unassigned', status: 'Open', due: '30m', tone: 'danger' }
];

export const notifications: Notification[] = [
  {
    title: 'Hazard report',
    detail: 'Wet surface reported near Zone C.',
    tone: 'danger',
    targetLabel: 'Open Tasks',
    targetSection: 'tasks'
  },
  {
    title: 'Fatigue watch',
    detail: 'Sari reached the break threshold.',
    tone: 'warning',
    targetLabel: 'View Worker',
    targetSection: 'workers',
    targetWorkerId: 'sari'
  },
  {
    title: 'Review ready',
    detail: 'Dimas uploaded scaffold inspection proof.',
    tone: 'success',
    targetLabel: 'Review Tasks',
    targetSection: 'tasks'
  }
];

export const statusLabels: Record<WorkerStatus, string> = {
  waiting: 'Waiting',
  working: 'Working',
  break: 'On Break',
  done: 'Done'
};

export const toneStyles: Record<Tone, string> = {
  neutral: 'bg-[#F1F2F7] text-[#5F5A56]',
  success: 'bg-[#FFF7ED] text-[#9A5719]',
  warning: 'bg-[#FFF4DC] text-[#8A4B02]',
  danger: 'bg-[#FFEFE6] text-[#B84011]'
};

export const statusStyles: Record<WorkerStatus, string> = {
  waiting: 'bg-[#F1F2F7] text-[#5F5A56]',
  working: 'bg-[#FFEFE6] text-[#C95119]',
  break: 'bg-[#FFF4DC] text-[#8A4B02]',
  done: 'bg-[#FFF7ED] text-[#7A4B22]'
};
