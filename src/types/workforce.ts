import type { ManagerSection } from './navigation';

export type WorkerStatus = 'waiting' | 'working' | 'break' | 'done' | 'emergency';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger';

export type WorkerEnvironment = {
  source: 'live' | 'stub';
  temperatureC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  recordedAt?: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
  summary: string;
};

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
  environment?: WorkerEnvironment;
};

export type SchedulerRecommendation = {
  totalWorkerHours: number;
  recommendedWorkerCount: number;
  recommendedCrewSize: number;
  estimatedTaskDuration: string;
  estimatedDuration: string;
  recommendedStartTime: string;
  estimatedCompletionTime: string;
  estimatedFinishTime: string;
  predictedWorkload?: 'Low' | 'Medium' | 'High';
  selectedWorkerRecommendations: Array<{
    workerId: string;
    workerName: string;
    explanation: string;
  }>;
  assignmentEngineVersion: string;
  expectedProductivityRate: string;
  deadlineFeasibilityStatus: string;
  capacityEstimatorVersion: string;
  requiredPpeAndCertifications: string[];
  dependencyStatus: string;
  currentEnvironmentalConditions: string;
  safetyAndOperationalWarnings: string[];
  chronosForecast: {
    futureProductivity: string;
    delayPrediction: string;
    suggestedAdditionalCrew: number;
    forecastVersion: string;
    confidence?: 'COLD_START' | 'INFERRED' | 'HISTORICAL';
    model?: string;
    modelStatus?: 'READY' | 'UNAVAILABLE';
    forecastValues?: number[];
  };
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
  temperatureC: number | null;
  humidityPct: number | null;
  workload: string;
  notes: string;
  schedulerRecommendation: SchedulerRecommendation;
  status: string;
  due: string;
  tone: Tone;
  completionProofImage?: string;
  completionProofSubmittedAt?: string;
  completionProofStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  completionProofNote?: string;
};

export type Notification = {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  targetLabel: string;
  targetSection: ManagerSection;
  targetWorkerId?: string;
  createdAt?: string;
  read: boolean;
};

export type WorkforceData = {
  workers: Worker[];
  tasks: Task[];
  notifications: Notification[];
};
