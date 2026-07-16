export type CapacityEnvironment = {
  temperatureC?: number | null;
  humidityPct?: number | null;
  workload?: string | null;
};

export type CapacityEstimateInput = {
  taskTemplate: string;
  quantity: number;
  deadline: string;
  environment?: CapacityEnvironment;
  availableWorkerCount?: number;
  now?: Date;
};

export type CapacityEstimate = {
  totalWorkerHours: number;
  recommendedCrewSize: number;
  estimatedDurationHours: number;
  estimatedDuration: string;
  estimatedFinishTime: string;
  deadlineFeasibilityStatus: 'FEASIBLE' | 'AT_RISK' | 'NOT_FEASIBLE' | 'UNKNOWN_DEADLINE';
  productivityRatePerWorkerHour: number;
  environmentFactor: number;
  predictedWorkload: 'Low' | 'Medium' | 'High';
  warnings: string[];
  estimatorVersion: 'capacity-estimator-v1';
};

const defaultProductivityRate = 8;

const templateProductivityRates: Record<string, number> = {
  install: 3,
  steel: 2.5,
  beam: 2.5,
  scaffold: 5,
  audit: 12,
  inspection: 10,
  cleanup: 18,
  concrete: 7,
  excavation: 6,
  electrical: 4
};

export function estimateCapacity(input: CapacityEstimateInput): CapacityEstimate {
  const now = input.now ?? new Date();
  const quantity = Math.max(1, input.quantity);
  const baseRate = getProductivityRate(input.taskTemplate);
  const predictedWorkload = inferWorkloadFromRate(input.taskTemplate, quantity, baseRate);
  const environmentFactor = getEnvironmentFactor({ ...input.environment, workload: input.environment?.workload ?? predictedWorkload });
  const adjustedRate = Math.max(0.5, baseRate * environmentFactor);
  const totalWorkerHours = round(quantity / adjustedRate, 2);
  const availableWorkerCount = Math.max(1, input.availableWorkerCount ?? 6);
  const recommendedCrewSize = Math.max(1, Math.min(availableWorkerCount, Math.ceil(totalWorkerHours / 4)));
  const estimatedDurationHours = round(totalWorkerHours / recommendedCrewSize, 2);
  const estimatedFinish = new Date(now.getTime() + estimatedDurationHours * 60 * 60 * 1000);
  const deadline = parseDeadline(input.deadline);
  const deadlineFeasibilityStatus = getDeadlineFeasibility(deadline, estimatedFinish);

  return {
    totalWorkerHours,
    recommendedCrewSize,
    estimatedDurationHours,
    estimatedDuration: formatDuration(estimatedDurationHours),
    estimatedFinishTime: estimatedFinish.toISOString(),
    deadlineFeasibilityStatus,
    productivityRatePerWorkerHour: round(adjustedRate, 2),
    environmentFactor,
    predictedWorkload,
    warnings: getWarnings({ ...input.environment, workload: input.environment?.workload ?? predictedWorkload }, deadlineFeasibilityStatus),
    estimatorVersion: 'capacity-estimator-v1'
  };
}

export function inferWorkload(taskTemplate: string, quantity: number): CapacityEstimate['predictedWorkload'] {
  return inferWorkloadFromRate(taskTemplate, Math.max(1, quantity), getProductivityRate(taskTemplate));
}

function inferWorkloadFromRate(taskTemplate: string, quantity: number, productivityRate: number): CapacityEstimate['predictedWorkload'] {
  const workerHours = quantity / productivityRate;
  const strenuousTask = /steel|beam|scaffold|concrete|excavat|rebar/i.test(taskTemplate);

  if (workerHours >= 16 || (strenuousTask && workerHours >= 10)) return 'High';
  if (workerHours >= 6 || strenuousTask) return 'Medium';
  return 'Low';
}

function getProductivityRate(taskTemplate: string) {
  const normalizedTemplate = taskTemplate.toLowerCase();
  const matchedKey = Object.keys(templateProductivityRates).find((key) => normalizedTemplate.includes(key));
  return matchedKey ? templateProductivityRates[matchedKey] : defaultProductivityRate;
}

function getEnvironmentFactor(environment?: CapacityEnvironment) {
  if (!environment) return 1;

  let factor = 1;

  if ((environment.temperatureC ?? 0) >= 35) factor -= 0.18;
  else if ((environment.temperatureC ?? 0) >= 32) factor -= 0.08;

  if ((environment.humidityPct ?? 0) >= 80) factor -= 0.08;

  if (environment.workload?.toLowerCase() === 'high') factor -= 0.16;
  else if (environment.workload?.toLowerCase() === 'medium') factor -= 0.08;

  return Math.max(0.45, round(factor, 2));
}

function parseDeadline(value: string) {
  const deadline = new Date(value);
  return Number.isNaN(deadline.getTime()) ? null : deadline;
}

function getDeadlineFeasibility(deadline: Date | null, estimatedFinish: Date): CapacityEstimate['deadlineFeasibilityStatus'] {
  if (!deadline) return 'UNKNOWN_DEADLINE';

  const slackHours = (deadline.getTime() - estimatedFinish.getTime()) / (60 * 60 * 1000);

  if (slackHours >= 1) return 'FEASIBLE';
  if (slackHours >= 0) return 'AT_RISK';
  return 'NOT_FEASIBLE';
}

function getWarnings(environment: CapacityEnvironment | undefined, feasibility: CapacityEstimate['deadlineFeasibilityStatus']) {
  const warnings: string[] = [];

  if (!environment) {
    warnings.push('No current environment input was available; estimate uses normal-condition productivity.');
  }

  if ((environment?.temperatureC ?? 0) >= 35) {
    warnings.push('High temperature reduces productivity and may require rest interventions.');
  }

  if (environment?.workload?.toLowerCase() === 'high') {
    warnings.push('High workload reduces effective productivity and may require a larger crew.');
  } else if (environment?.workload?.toLowerCase() === 'medium') {
    warnings.push('Medium workload slightly reduces effective productivity.');
  }

  if (feasibility === 'NOT_FEASIBLE') {
    warnings.push('Estimated finish is after the deadline.');
  } else if (feasibility === 'AT_RISK') {
    warnings.push('Deadline has less than one hour of schedule buffer.');
  } else if (feasibility === 'UNKNOWN_DEADLINE') {
    warnings.push('Deadline could not be parsed; use a date/time deadline for feasibility checks.');
  }

  return warnings;
}

function formatDuration(hours: number) {
  const totalMinutes = Math.max(1, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

function round(value: number, places: number) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}
