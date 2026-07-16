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

export type SchedulerRecommendation = {
  recommendedWorkerCount: number;
  estimatedTaskDuration: string;
  recommendedStartTime: string;
  estimatedCompletionTime: string;
  selectedWorkerRecommendations: Array<{
    workerId: string;
    workerName: string;
    explanation: string;
  }>;
  expectedProductivityRate: string;
  deadlineFeasibilityStatus: string;
  requiredPpeAndCertifications: string[];
  dependencyStatus: string;
  currentEnvironmentalConditions: string;
  safetyAndOperationalWarnings: string[];
  schedulerStatus: string;
};

export type Task = {
  id: string;
  title: string;
  owner: string;
  location: string;
  taskTemplate: string;
  project: string;
  zone: string;
  quantity: number;
  unit: string;
  deadline: string;
  priority: string;
  notes: string;
  schedulerRecommendation: SchedulerRecommendation;
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
