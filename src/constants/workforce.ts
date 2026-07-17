import type { Notification, SchedulerRecommendation, Task, Tone, Worker, WorkerStatus } from '../types/workforce';

export const workers: Worker[] = [
  {
    id: 'budi',
    name: 'Budi Santoso',
    role: 'Steel Crew',
    task: 'Install steel beam',
    status: 'working',
    zone: 'Zone C',
    time: '02:14',
    yesterdayWorkedMinutes: 485,
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
    yesterdayWorkedMinutes: 535,
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
    yesterdayWorkedMinutes: 430,
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
    yesterdayWorkedMinutes: 475,
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
    yesterdayWorkedMinutes: 565,
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
    yesterdayWorkedMinutes: 410,
    workload: 'High',
    fatigue: 44,
    pay: 'Rp210.000',
    match: 89
  }
];

export const tasks: Task[] = [
  makeSeedTask('steel-beam-install', 'Steel beam installation', 'Core Tower', 'Zone C', 8, 'beams', 4, 'High', 'High'),
  makeSeedTask('harness-audit', 'Harness safety audit', 'Core Tower', 'Zone B', 18, 'workers', 6, 'Medium', 'Medium'),
  makeSeedTask('scaffold-access-check', 'Scaffold access check', 'Podium', 'Zone A', 6, 'levels', 3, 'High', 'High'),
  makeSeedTask('wet-surface-cleanup', 'Wet surface cleanup', 'Podium', 'Zone C', 120, 'm2', 2, 'Critical', 'High'),
  makeSeedTask('concrete-formwork-inspection', 'Concrete formwork inspection', 'North Wing', 'Zone D', 14, 'sections', 8, 'Medium', 'High'),
  makeSeedTask('electrical-cable-routing', 'Electrical cable routing', 'Core Tower', 'Zone E', 240, 'meters', 12, 'Medium', 'Medium'),
  makeSeedTask('material-staging', 'Material staging', 'Loading Bay', 'Gate 2', 32, 'pallets', 5, 'Low', 'Medium'),
  makeSeedTask('debris-cleanup', 'Construction debris cleanup', 'South Wing', 'Zone A', 180, 'm2', 10, 'Low', 'Low'),
  makeSeedTask('crane-exclusion-zone', 'Crane exclusion zone setup', 'Core Tower', 'Zone B', 12, 'barriers', 4, 'High', 'Medium'),
  makeSeedTask('fire-equipment-inspection', 'Fire equipment inspection', 'Podium', 'Zone D', 24, 'units', 16, 'Medium', 'Low'),
  makeSeedTask('drainage-clearing', 'Temporary drainage clearing', 'Perimeter', 'Zone C', 75, 'meters', 7, 'High', 'High'),
  makeSeedTask('ppe-inventory', 'PPE inventory count', 'Site Office', 'Warehouse', 160, 'items', 24, 'Low', 'Low'),
  makeSeedTask('loading-bay-marking', 'Loading bay safety marking', 'Loading Bay', 'Gate 1', 90, 'meters', 14, 'Medium', 'Medium'),
  makeSeedTask('rebar-bundle-prep', 'Rebar bundle preparation', 'North Wing', 'Zone E', 20, 'bundles', 9, 'High', 'High')
];

function makeSeedTask(
  id: string,
  template: string,
  project: string,
  zone: string,
  quantity: number,
  unit: string,
  deadlineOffsetHours: number,
  priority: string,
  intensity: Task['intensity']
): Task {
  const deadline = new Date(Date.now() + deadlineOffsetHours * 60 * 60 * 1000).toISOString();

  return {
    id,
    title: template,
    owner: 'Unassigned',
    location: zone,
    taskTemplate: template,
    project,
    zone,
    quantity,
    unit,
    deadline,
    priority,
    intensity,
    temperatureC: null,
    humidityPct: null,
    workload: intensity === 'High' || priority === 'Critical' ? 'High' : intensity,
    notes: '',
    schedulerRecommendation: makeSeedSchedulerRecommendation(priority),
    status: 'Open',
    due: deadline,
    tone: priority === 'Critical' ? 'danger' : priority === 'High' ? 'warning' : 'neutral'
  };
}

function makeSeedSchedulerRecommendation(priority: string): SchedulerRecommendation {
  const urgent = priority === 'High' || priority === 'Critical';

  return {
    totalWorkerHours: urgent ? 7.5 : 3,
    recommendedWorkerCount: urgent ? 3 : 2,
    recommendedCrewSize: urgent ? 3 : 2,
    estimatedTaskDuration: urgent ? '2h 30m' : '1h 30m',
    estimatedDuration: urgent ? '2h 30m' : '1h 30m',
    recommendedStartTime: 'Next available safe window',
    estimatedCompletionTime: urgent ? 'Before current shift end' : 'Same day',
    estimatedFinishTime: urgent ? 'Before current shift end' : 'Same day',
    selectedWorkerRecommendations: [
      {
        workerId: 'budi',
        workerName: 'Budi Santoso',
        explanation: 'Strong task match and currently assigned near the work zone.'
      }
    ],
    assignmentEngineVersion: 'worker-assignment-engine-v1',
    expectedProductivityRate: urgent ? 'High with 3-worker crew' : 'Standard crew output',
    deadlineFeasibilityStatus: urgent ? 'Feasible with safety review' : 'Feasible',
    capacityEstimatorVersion: 'capacity-estimator-v2',
    requiredPpeAndCertifications: ['Helmet', 'Safety shoes', 'Harness if working at height'],
    dependencyStatus: 'No blocking dependency inferred from current task state',
    currentEnvironmentalConditions: 'Uses the latest IoT site conditions for task planning',
    safetyAndOperationalWarnings: urgent ? ['Supervisor confirmation required before start'] : ['Standard toolbox check required'],
    chronosForecast: {
      futureProductivity: urgent ? '3.2 units/worker-hour' : '2.1 units/worker-hour',
      delayPrediction: urgent ? 'Delay risk low with recommended crew.' : 'Delay risk low under current trend.',
      suggestedAdditionalCrew: 0,
      forecastVersion: 'chronos-2-fastapi-v1',
      confidence: 'INFERRED',
      model: 'amazon/chronos-2',
      modelStatus: 'READY',
      forecastValues: urgent ? [3.1, 3.2, 3.25, 3.18] : [2.0, 2.1, 2.15, 2.12]
    },
    schedulerStatus: 'Live scheduler inference: capacity, worker assignment, fatigue status, and Chronos-2 forecasting use current task and worker data.'
  };
}

export const notifications: Notification[] = [
  {
    id: 'hazard-zone-c',
    title: 'Hazard report',
    detail: 'Wet surface reported near Zone C.',
    tone: 'danger',
    targetLabel: 'Open Tasks',
    targetSection: 'tasks',
    read: false
  },
  {
    id: 'fatigue-sari',
    title: 'Fatigue watch',
    detail: 'Sari reached the break threshold.',
    tone: 'warning',
    targetLabel: 'View Worker',
    targetSection: 'workers',
    targetWorkerId: 'sari',
    read: false
  },
  {
    id: 'review-dimas',
    title: 'Review ready',
    detail: 'Dimas uploaded scaffold inspection proof.',
    tone: 'success',
    targetLabel: 'Review Tasks',
    targetSection: 'tasks',
    read: false
  }
];

export const statusLabels: Record<WorkerStatus, string> = {
  waiting: 'Waiting',
  working: 'Working',
  break: 'On Break',
  done: 'Done',
  emergency: 'Emergency'
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
  done: 'bg-[#FFF7ED] text-[#7A4B22]',
  emergency: 'bg-[#FFEFE6] text-[#B84011]'
};
