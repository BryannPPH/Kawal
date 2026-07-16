import type { ManagerSection } from './navigation';

export type WorkerStatus = 'waiting' | 'working' | 'break' | 'done' | 'emergency';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger';

export type Worker = {
  id: string;
  name: string;
  role: string;
  task: string;
  status: WorkerStatus;
  zone: string;
  time: string;
  workload: string;
  fatigue: number;
  pay: string;
  match: number;
};

export type Task = {
  id: string;
  title: string;
  owner: string;
  location: string;
  status: string;
  due: string;
  tone: Tone;
};

export type Notification = {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  targetLabel: string;
  targetSection: ManagerSection;
  targetWorkerId?: string;
  read: boolean;
};

export type WorkforceData = {
  workers: Worker[];
  tasks: Task[];
  notifications: Notification[];
};
