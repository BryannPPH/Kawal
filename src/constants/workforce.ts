import type { Notification, SchedulerRecommendation, Task, Tone, Worker, WorkerStatus } from '../types/workforce';

export const workers: Worker[] = [
  {
    id: 'budi',
    name: 'Budi Santoso',
    role: 'Steel Erector',
    task: 'Steel alignment check',
    status: 'working',
    zone: 'Zone C',
    time: '02:14',
    yesterdayWorkedMinutes: 485,
    workload: 'Medium',
    fatigue: 28,
    pay: 'Rp180.000',
    match: 94
  },
  {
    id: 'ag',
    name: 'Agus Pratama',
    role: 'Crane Signalman',
    task: 'Available for lifting operation',
    status: 'waiting',
    zone: 'Zone B',
    time: '00:00',
    yesterdayWorkedMinutes: 535,
    workload: 'Medium',
    fatigue: 46,
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
    fatigue: 16,
    pay: 'Rp95.000',
    match: 81
  },
  {
    id: 'dewi',
    name: 'Dewi Lestari',
    role: 'HSE Inspector',
    task: 'Ready for safety review',
    status: 'waiting',
    zone: 'Zone B',
    time: '00:00',
    yesterdayWorkedMinutes: 475,
    workload: 'Low',
    fatigue: 21,
    pay: 'Rp120.000',
    match: 84
  },
  {
    id: 'sari',
    name: 'Sari Ningsih',
    role: 'Scaffold Technician',
    task: 'Recovery break',
    status: 'break',
    zone: 'Rest Area',
    time: '00:12',
    yesterdayWorkedMinutes: 565,
    workload: 'High',
    fatigue: 67,
    pay: 'Rp145.000',
    match: 76
  },
  {
    id: 'dimas',
    name: 'Dimas Ardi',
    role: 'QA/QC Inspector',
    task: 'Morning inspection complete',
    status: 'done',
    zone: 'Zone A',
    time: '03:20',
    yesterdayWorkedMinutes: 410,
    workload: 'Low',
    fatigue: 28,
    pay: 'Rp210.000',
    match: 89
  },
  {
    id: 'andi',
    name: 'Andi Wijaya',
    role: 'Electrician',
    task: 'Cable continuity test',
    status: 'working',
    zone: 'Zone E',
    time: '01:18',
    yesterdayWorkedMinutes: 500,
    workload: 'Medium',
    fatigue: 34,
    pay: 'Rp175.000',
    match: 91
  },
  {
    id: 'maya',
    name: 'Maya Putri',
    role: 'First Aid & Safety',
    task: 'Available near safety post',
    status: 'waiting',
    zone: 'Zone D',
    time: '00:00',
    yesterdayWorkedMinutes: 450,
    workload: 'Low',
    fatigue: 14,
    pay: 'Rp155.000',
    match: 86
  },
  {
    id: 'fajar',
    name: 'Fajar Ramadhan',
    role: 'Concrete Crew',
    task: 'Formwork material handling',
    status: 'working',
    zone: 'Zone D',
    time: '03:06',
    yesterdayWorkedMinutes: 590,
    workload: 'High',
    fatigue: 72,
    pay: 'Rp165.000',
    match: 83
  },
  {
    id: 'nadia',
    name: 'Nadia Permata',
    role: 'Logistics Coordinator',
    task: 'Ready for material dispatch',
    status: 'waiting',
    zone: 'Gate 1',
    time: '00:00',
    yesterdayWorkedMinutes: 390,
    workload: 'Low',
    fatigue: 11,
    pay: 'Rp145.000',
    match: 87
  },
  {
    id: 'yusuf',
    name: 'Yusuf Hidayat',
    role: 'Certified Rigger',
    task: 'Ready for lifting support',
    status: 'waiting',
    zone: 'Zone C',
    time: '00:00',
    yesterdayWorkedMinutes: 520,
    workload: 'Medium',
    fatigue: 43,
    pay: 'Rp185.000',
    match: 92
  },
  {
    id: 'rina',
    name: 'Rina Kurnia',
    role: 'Fire Safety Inspector',
    task: 'Available for equipment audit',
    status: 'waiting',
    zone: 'Zone D',
    time: '00:00',
    yesterdayWorkedMinutes: 460,
    workload: 'Low',
    fatigue: 20,
    pay: 'Rp160.000',
    match: 90
  }
];

export const tasks: Task[] = [
  makeSeedTask({ id: 'wet-surface-cleanup', template: 'Wet surface cleanup', project: 'Podium', zone: 'Zone C', quantity: 120, unit: 'm2', day: 0, hour: 19, priority: 'Critical', intensity: 'High', workload: 'High' }),
  makeSeedTask({ id: 'crane-exclusion-zone', template: 'Crane exclusion zone setup', project: 'Core Tower', zone: 'Zone B', quantity: 12, unit: 'barriers', day: 0, hour: 21, priority: 'High', intensity: 'Medium', workload: 'Medium' }),
  makeSeedTask({ id: 'steel-beam-install', template: 'Steel beam installation', project: 'Core Tower', zone: 'Zone C', quantity: 8, unit: 'beams', day: 1, hour: 10, priority: 'High', intensity: 'High', workload: 'High' }),
  makeSeedTask({ id: 'harness-audit', template: 'Harness safety audit', project: 'Core Tower', zone: 'Zone B', quantity: 18, unit: 'workers', day: 1, hour: 13, priority: 'Medium', intensity: 'Medium', workload: 'Medium' }),
  makeSeedTask({ id: 'material-staging', template: 'Material staging', project: 'Loading Bay', zone: 'Gate 2', quantity: 32, unit: 'pallets', day: 1, hour: 16, priority: 'Low', intensity: 'Medium', workload: 'Medium' }),
  makeSeedTask({ id: 'scaffold-access-check', template: 'Scaffold access check', project: 'Podium', zone: 'Zone A', quantity: 6, unit: 'levels', day: 2, hour: 9, priority: 'High', intensity: 'High', workload: 'High' }),
  makeSeedTask({ id: 'fire-equipment-inspection', template: 'Fire equipment inspection', project: 'Podium', zone: 'Zone D', quantity: 24, unit: 'units', day: 2, hour: 12, priority: 'Medium', intensity: 'Low', workload: 'Low' }),
  makeSeedTask({ id: 'electrical-cable-routing', template: 'Electrical cable routing', project: 'Core Tower', zone: 'Zone E', quantity: 240, unit: 'meters', day: 2, hour: 17, priority: 'Medium', intensity: 'Medium', workload: 'High' }),
  makeSeedTask({ id: 'concrete-formwork-inspection', template: 'Concrete formwork inspection', project: 'North Wing', zone: 'Zone D', quantity: 14, unit: 'sections', day: 3, hour: 10, priority: 'Medium', intensity: 'High', workload: 'High' }),
  makeSeedTask({ id: 'loading-bay-marking', template: 'Loading bay safety marking', project: 'Loading Bay', zone: 'Gate 1', quantity: 90, unit: 'meters', day: 3, hour: 14, priority: 'Medium', intensity: 'Medium', workload: 'Medium' }),
  makeSeedTask({ id: 'ppe-inventory', template: 'PPE inventory count', project: 'Site Office', zone: 'Warehouse', quantity: 160, unit: 'items', day: 3, hour: 16, priority: 'Low', intensity: 'Low', workload: 'Low' }),
  makeSeedTask({ id: 'drainage-clearing', template: 'Temporary drainage clearing', project: 'Perimeter', zone: 'Zone C', quantity: 75, unit: 'meters', day: 4, hour: 9, priority: 'High', intensity: 'High', workload: 'High' }),
  makeSeedTask({ id: 'rebar-bundle-prep', template: 'Rebar bundle preparation', project: 'North Wing', zone: 'Zone E', quantity: 20, unit: 'bundles', day: 4, hour: 13, priority: 'High', intensity: 'High', workload: 'High' }),
  makeSeedTask({ id: 'emergency-lighting-test', template: 'Emergency lighting test', project: 'South Wing', zone: 'Zone D', quantity: 30, unit: 'fixtures', day: 4, hour: 16, priority: 'Medium', intensity: 'Low', workload: 'Medium' }),
  makeSeedTask({ id: 'debris-cleanup', template: 'Construction debris cleanup', project: 'South Wing', zone: 'Zone A', quantity: 180, unit: 'm2', day: 5, hour: 10, priority: 'Low', intensity: 'Medium', workload: 'Medium' }),
  makeSeedTask({ id: 'guardrail-torque-inspection', template: 'Guardrail torque inspection', project: 'Core Tower', zone: 'Zone C', quantity: 42, unit: 'joints', day: 5, hour: 13, priority: 'High', intensity: 'Medium', workload: 'Medium' }),
  makeSeedTask({ id: 'cable-tray-labeling', template: 'Cable tray labeling', project: 'Core Tower', zone: 'Zone E', quantity: 120, unit: 'labels', day: 5, hour: 16, priority: 'Low', intensity: 'Low', workload: 'Low' }),
  makeSeedTask({ id: 'excavation-barricade-inspection', template: 'Excavation barricade inspection', project: 'Perimeter', zone: 'Zone B', quantity: 16, unit: 'sections', day: 6, hour: 9, priority: 'Critical', intensity: 'High', workload: 'High' }),
  makeSeedTask({ id: 'concrete-curing-check', template: 'Concrete curing check', project: 'North Wing', zone: 'Zone D', quantity: 20, unit: 'sections', day: 6, hour: 12, priority: 'Medium', intensity: 'Medium', workload: 'Medium' }),
  makeSeedTask({ id: 'tool-accountability-audit', template: 'Tool accountability audit', project: 'Site Office', zone: 'Warehouse', quantity: 85, unit: 'tools', day: 6, hour: 15, priority: 'Low', intensity: 'Low', workload: 'Low' }),
  makeSeedTask({ id: 'scaffold-dismantling-prep', template: 'Scaffold dismantling preparation', project: 'Podium', zone: 'Zone A', quantity: 10, unit: 'bays', day: 6, hour: 17, priority: 'High', intensity: 'High', workload: 'High' })
];

type SeedTaskInput = {
  id: string;
  template: string;
  project: string;
  zone: string;
  quantity: number;
  unit: string;
  day: number;
  hour: number;
  priority: string;
  intensity: Task['intensity'];
  workload: 'Low' | 'Medium' | 'High';
};

function makeSeedTask(input: SeedTaskInput): Task {
  const deadline = makeSeedDeadline(input.day, input.hour);

  return {
    id: input.id,
    title: input.template,
    owner: 'Unassigned',
    location: input.zone,
    taskTemplate: input.template,
    project: input.project,
    zone: input.zone,
    quantity: input.quantity,
    unit: input.unit,
    deadline,
    priority: input.priority,
    intensity: input.intensity,
    temperatureC: null,
    humidityPct: null,
    workload: input.workload,
    notes: '',
    schedulerRecommendation: makeSeedSchedulerRecommendation(input.priority, input.workload),
    status: 'Open',
    due: deadline,
    tone: input.priority === 'Critical' ? 'danger' : input.priority === 'High' ? 'warning' : 'neutral'
  };
}

function makeSeedDeadline(dayOffset: number, hour: number) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + dayOffset);
  deadline.setHours(hour, 0, 0, 0);
  return deadline.toISOString();
}

function makeSeedSchedulerRecommendation(priority: string, workload: 'Low' | 'Medium' | 'High'): SchedulerRecommendation {
  const urgent = priority === 'High' || priority === 'Critical';
  const demanding = workload === 'High';

  return {
    totalWorkerHours: demanding ? 10 : workload === 'Medium' ? 5 : 2.5,
    recommendedWorkerCount: demanding ? 3 : 2,
    recommendedCrewSize: demanding ? 3 : 2,
    estimatedTaskDuration: demanding ? '3h 20m' : workload === 'Medium' ? '2h 30m' : '1h 15m',
    estimatedDuration: demanding ? '3h 20m' : workload === 'Medium' ? '2h 30m' : '1h 15m',
    recommendedStartTime: 'Next available safe window',
    estimatedCompletionTime: urgent ? 'Before current shift end' : 'Same day',
    estimatedFinishTime: urgent ? 'Before current shift end' : 'Same day',
    predictedWorkload: workload,
    selectedWorkerRecommendations: [],
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
