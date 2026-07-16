import type { Worker, WorkerStatus } from '../types/workforce';

export type WorkerAssignmentInput = {
  taskTemplate: string;
  requiredSkills?: string[];
  requiredCertifications?: string[];
  zone?: string;
  recommendedCrewSize: number;
  workers: Worker[];
};

export type WorkerRecommendation = {
  workerId: string;
  workerName: string;
  score: number;
  reasons: string[];
  explanation: string;
};

const unavailableStatuses = new Set<WorkerStatus>(['break', 'done', 'emergency']);

export function recommendWorkers(input: WorkerAssignmentInput): WorkerRecommendation[] {
  return input.workers
    .map((worker) => scoreWorker(worker, input))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, input.recommendedCrewSize));
}

function scoreWorker(worker: Worker, input: WorkerAssignmentInput): WorkerRecommendation {
  const reasons: string[] = [];
  const coldStart = !Number.isFinite(worker.match) || worker.match <= 0 || worker.task.toLowerCase().includes('new employee');
  let score = coldStart ? 58 : worker.match;

  if (coldStart) {
    reasons.push('Cold-start worker profile: using conservative baseline before assignment');
  }

  if (!unavailableStatuses.has(worker.status)) {
    score += 16;
    reasons.push(`Available status: ${worker.status === 'waiting' ? 'Waiting' : 'Working'}`);
  } else {
    score -= 35;
    reasons.push(`Availability blocked by ${formatStatus(worker.status)}`);
  }

  const skillMatch = hasSkillMatch(worker, input.taskTemplate, input.requiredSkills);
  if (skillMatch) {
    score += 14;
    reasons.push('Skill match for task template');
  } else if (coldStart) {
    score -= 4;
    reasons.push('Skill history unavailable; requires supervisor confirmation');
  } else {
    score -= 8;
    reasons.push('Skill match is partial');
  }

  const certificationMatch = hasCertificationMatch(worker, input.requiredCertifications);
  if (certificationMatch) {
    score += 10;
    reasons.push('Required certification coverage');
  } else if (coldStart) {
    score -= 16;
    reasons.push('Certification history unavailable for new worker');
  } else {
    score -= 10;
    reasons.push('Certification requires supervisor review');
  }

  if (input.zone && worker.zone === input.zone) {
    score += 8;
    reasons.push('Already near the task zone');
  }

  if (worker.workload.toLowerCase() === 'low') {
    score += 8;
    reasons.push('Low current workload');
  } else if (worker.workload.toLowerCase() === 'high') {
    score -= 10;
    reasons.push('High current workload');
  } else {
    reasons.push('Workload is manageable');
  }

  if (worker.fatigue >= 65) {
    score -= 24;
    reasons.push('Fatigue status requires caution');
  } else if (worker.fatigue >= 45) {
    score -= 10;
    reasons.push('Moderate fatigue status');
  } else {
    score += 10;
    reasons.push('Fatigue status is acceptable');
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    workerId: worker.id,
    workerName: worker.name,
    score: boundedScore,
    reasons,
    explanation: `${worker.name} scored ${boundedScore}%: ${reasons.slice(0, 3).join('; ')}.`
  };
}

function hasSkillMatch(worker: Worker, taskTemplate: string, requiredSkills?: string[]) {
  const haystack = `${worker.role} ${worker.task}`.toLowerCase();
  const skills = requiredSkills?.length ? requiredSkills : taskTemplate.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
  return skills.some((skill) => haystack.includes(skill.toLowerCase()));
}

function hasCertificationMatch(worker: Worker, requiredCertifications?: string[]) {
  if (!requiredCertifications?.length) return true;
  const role = worker.role.toLowerCase();
  return requiredCertifications.every((certification) => {
    const normalized = certification.toLowerCase();
    if (normalized.includes('harness')) return role.includes('steel') || role.includes('scaffold') || role.includes('safety');
    if (normalized.includes('crane')) return role.includes('crane');
    if (normalized.includes('inspection')) return role.includes('inspector') || role.includes('safety');
    return true;
  });
}

function formatStatus(status: WorkerStatus) {
  return status === 'break' ? 'On Break' : status === 'done' ? 'Done' : status === 'emergency' ? 'Emergency' : status;
}
