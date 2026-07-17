import { Activity, BrainCircuit, Check, ClipboardList, ShieldAlert, TimerReset, TrendingUp, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SchedulerRecommendation, Task, Worker } from '../../../types/workforce';
import { AssignmentPanel } from '../components/AssignmentPanel';
import { MetricCard } from '../components/MetricCard';
import { WorkerBoard } from '../components/WorkerBoard';

type DashboardViewProps = {
  selectedWorker: Worker;
  workers: Worker[];
  tasks: Task[];
  onSelectWorker: (worker: Worker) => void;
  onAutoAssign: (taskId: string, workerId?: string) => Promise<Task>;
};

export function DashboardView({ selectedWorker, workers, tasks, onSelectWorker, onAutoAssign }: DashboardViewProps) {
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [liveForecast, setLiveForecast] = useState<SchedulerRecommendation['chronosForecast'] | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const workingCount = workers.filter((worker) => worker.status === 'working').length;
  const breakCount = workers.filter((worker) => worker.status === 'break').length;
  const waitingCount = workers.filter((worker) => worker.status === 'waiting').length;
  const managerTasks = useMemo(() => tasks.filter((task) => !isSystemGeneratedTask(task)), [tasks]);
  const reviewCount = managerTasks.filter((task) => task.status.toLowerCase().includes('review')).length;
  const openTaskCount = managerTasks.filter((task) => !isTaskComplete(task)).length;
  const averageFatigue = workers.length ? Math.round(workers.reduce((sum, worker) => sum + worker.fatigue, 0) / workers.length) : 0;
  const completionPct = managerTasks.length ? Math.round(((managerTasks.length - openTaskCount) / managerTasks.length) * 100) : 0;
  const visualMetrics = [
    { label: 'Crew in motion', value: String(workingCount), detail: `${waitingCount} waiting assignment`, icon: Users },
    { label: 'Open tasks', value: String(openTaskCount), detail: `${reviewCount} ready for review`, icon: ClipboardList },
    { label: 'Avg fatigue', value: `${averageFatigue}%`, detail: `${breakCount} currently on break`, icon: ShieldAlert }
  ];
  const recommendedTask = useMemo(() => {
    const unassignedTasks = managerTasks.filter((task) => task.owner === 'Unassigned');
    return unassignedTasks.find((task) => task.schedulerRecommendation.selectedWorkerRecommendations.length > 0) ?? unassignedTasks[0] ?? null;
  }, [managerTasks]);
  const forecastTask = useMemo(() => {
    return recommendedTask
      ?? managerTasks.find((task) => task.status.toLowerCase().includes('progress'))
      ?? managerTasks.find((task) => !isTaskComplete(task))
      ?? managerTasks[0]
      ?? null;
  }, [managerTasks, recommendedTask]);
  const productivityForecast = forecastTask?.schedulerRecommendation.chronosForecast ?? liveForecast;

  useEffect(() => {
    if (forecastTask || !workers.length) {
      return;
    }

    let cancelled = false;
    const activeWorkers = Math.max(1, workers.filter((worker) => !['break', 'emergency'].includes(worker.status)).length);
    const averageWorkMinutes = workers.reduce((sum, worker) => sum + parseWorkerTimeMinutes(worker.time), 0) / workers.length;
    const fatigueDrag = Math.max(0.45, 1 - averageFatigue / 160);
    const workerHours = [
      Math.max(1, activeWorkers * Math.max(0.75, averageWorkMinutes / 90)),
      Math.max(1, activeWorkers * Math.max(1, averageWorkMinutes / 75)),
      Math.max(1, activeWorkers * Math.max(1.25, averageWorkMinutes / 60))
    ];
    const completedBase = Math.max(1, activeWorkers * 6 * fatigueDrag);

    async function loadLiveForecast() {
      setForecastLoading(true);

      try {
        const response = await fetch('/api/chronos/forecast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            historicalCompletedQuantity: [
              Math.round(completedBase * 0.82),
              Math.round(completedBase),
              Math.round(completedBase * (workingCount ? 1.12 : 0.92))
            ],
            workerHours,
            breakMinutes: [breakCount * 5, breakCount * 8, Math.max(5, breakCount * 10 + Math.round(averageFatigue / 10))],
            activeWorkers: [activeWorkers, activeWorkers, Math.max(1, activeWorkers - breakCount)],
            predictionLength: 4
          })
        });
        const payload = await response.json();

        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? `API returned ${response.status}`);
        }

        if (!cancelled) {
          setLiveForecast(payload as SchedulerRecommendation['chronosForecast']);
        }
      } catch (error) {
        if (!cancelled) {
          setLiveForecast({
            futureProductivity: 'Forecast unavailable',
            delayPrediction: error instanceof Error ? error.message : 'Chronos forecast unavailable',
            suggestedAdditionalCrew: 0,
            forecastVersion: 'chronos-2-fastapi-v1',
            confidence: 'COLD_START',
            model: 'amazon/chronos-2',
            modelStatus: 'UNAVAILABLE',
            forecastValues: []
          });
        }
      } finally {
        if (!cancelled) {
          setForecastLoading(false);
        }
      }
    }

    loadLiveForecast();

    return () => {
      cancelled = true;
    };
  }, [averageFatigue, breakCount, forecastTask, workers, workingCount]);

  const selectDashboardWorker = (worker: Worker) => {
    setAssignmentError(null);
    setAssignmentSuccess(null);
    onSelectWorker(worker);
  };

  const approveRecommendedAssignment = async (workerId?: string) => {
    if (!recommendedTask) {
      return;
    }

    setAssigningTaskId(recommendedTask.id);
    setAssignmentError(null);
    setAssignmentSuccess(null);

    try {
      const assignedTask = await onAutoAssign(recommendedTask.id, workerId);
      const assignedWorker = workers.find((worker) => worker.name === assignedTask.owner);

      if (assignedWorker) {
        onSelectWorker(assignedWorker);
      }

      setAssignmentSuccess(`${assignedTask.taskTemplate} assigned to ${assignedTask.owner}.`);
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'Unable to assign task');
    } finally {
      setAssigningTaskId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-[#F3D7C8] bg-white">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex items-center p-6 sm:p-7">
            <div className="grid w-full gap-4 sm:grid-cols-3">
              {visualMetrics.map((item) => (
                <MetricCard key={item.label} {...item} />
              ))}
            </div>
          </div>

          <div className="border-t border-[#F3D7C8] bg-[#FFF8F4] p-6 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#2F2C2A]">Shift Balance</p>
                <p className="mt-1 text-sm text-[#776B63]">Workload and rest in one glance.</p>
              </div>
              <Activity size={19} className="text-[#FD7124]" />
            </div>

            <div className="mt-6 space-y-5">
              <VisualBar label="Completion" value={completionPct} accent="bg-[#55936A]" />
              <VisualBar label="Workers active" value={workers.length ? Math.round((workingCount / workers.length) * 100) : 0} accent="bg-[#FD7124]" />
              <VisualBar label="Fatigue load" value={averageFatigue} accent={averageFatigue >= 65 ? 'bg-[#CF5A4F]' : 'bg-[#FAA745]'} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#F3D7C8] bg-white p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Today&apos;s Focus</p>
          </div>
          <Check size={18} className="text-[#55936A]" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <FocusCard icon={ClipboardList} label="Task flow" value={`${openTaskCount} open`} detail="Create, assign, and review from Tasks." />
          <FocusCard icon={TimerReset} label="Rest control" value={`${breakCount} on break`} detail="Fatigue signals stay visible in IoT." />
          <FocusCard icon={Users} label="Crew coverage" value={`${workers.length} tracked`} detail="Worker status updates as tasks move." />
        </div>
      </section>

      <ProjectPaceForecastPanel
        forecast={productivityForecast}
        loading={forecastLoading && !productivityForecast}
        tasks={managerTasks}
        workers={workers}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <AssignmentPanel
          selectedWorker={selectedWorker}
          workers={workers}
          task={recommendedTask}
          assigning={Boolean(recommendedTask && assigningTaskId === recommendedTask.id)}
          error={assignmentError}
          success={assignmentSuccess}
          onSelectWorker={selectDashboardWorker}
          onApprove={approveRecommendedAssignment}
        />
        <WorkerBoard workers={workers} selectedWorker={selectedWorker} onSelectWorker={selectDashboardWorker} compact />
      </section>
    </div>
  );
}

function ProjectPaceForecastPanel({
  forecast,
  loading,
  tasks,
  workers
}: {
  forecast?: SchedulerRecommendation['chronosForecast'] | null;
  loading: boolean;
  tasks: Task[];
  workers: Worker[];
}) {
  const projectTasks = tasks;
  const projectNames = Array.from(new Set(projectTasks.map((task) => task.project).filter(Boolean)));
  const projectName = projectNames.length === 1 ? projectNames[0] : projectNames.length > 1 ? `${projectNames.length} active projects` : 'No project selected';
  const completedTasks = projectTasks.filter(isTaskComplete);
  const reviewTasks = projectTasks.filter((task) => task.status.toLowerCase().includes('review') || task.completionProofStatus === 'PENDING');
  const rejectedTasks = projectTasks.filter((task) => task.completionProofStatus === 'REJECTED');
  const plannedCount = projectTasks.length;
  const completedCount = completedTasks.length;
  const remainingCount = Math.max(0, plannedCount - completedCount);
  const completionPct = plannedCount ? Math.round((completedCount / plannedCount) * 100) : 0;
  const totalEstimatedHours = projectTasks.reduce((sum, task) => sum + getTaskEstimatedHours(task), 0);
  const remainingEstimatedHours = projectTasks
    .filter((task) => !isTaskComplete(task))
    .reduce((sum, task) => sum + getTaskEstimatedHours(task), 0);
  const observedWorkerHours = getObservedWorkerHours(completedTasks, projectTasks, workers);
  const actualRate = completedCount && observedWorkerHours ? completedCount / observedWorkerHours : 0;
  const requiredRate = remainingCount && remainingEstimatedHours ? remainingCount / remainingEstimatedHours : 0;
  const paceRatio = actualRate && requiredRate ? actualRate / requiredRate : 0;
  const paceStatus = getPaceStatus(plannedCount, completedCount, paceRatio);
  const paceClass = getPaceClass(paceStatus);
  const values = forecast?.forecastValues?.length ? forecast.forecastValues : [];
  const modelReady = forecast?.modelStatus === 'READY';
  const chartSeries = buildProjectPaceSeries({
    plannedCount,
    completedCount,
    completedTasks,
    forecastValues: values
  });
  const recommendation = getPaceRecommendation({
    plannedCount,
    completedCount,
    actualRate,
    requiredRate,
    rejectedCount: rejectedTasks.length,
    suggestedAdditionalCrew: forecast?.suggestedAdditionalCrew ?? 0
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-[#F3D7C8] bg-white">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#C95119]">
                <BrainCircuit size={17} />
                Project Pace Forecast
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-normal text-[#2F2C2A]">
                {plannedCount ? `${paceStatus} / ${completionPct}% complete` : 'Create tasks to start pace tracking'}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#776B63]">
                {plannedCount
                  ? `${projectName}: ${completedCount} accepted of ${plannedCount} planned tasks. ${recommendation}`
                  : 'The forecast compares manager-planned tasks against accepted completion proof and observed worker-hours.'}
              </p>
            </div>
            <span className={`inline-flex h-9 shrink-0 items-center justify-center rounded-xl px-3 text-xs font-bold ${paceClass}`}>
              {paceStatus}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <ForecastMetric label="Planned work" value={`${plannedCount} tasks`} />
            <ForecastMetric label="Actual productivity" value={actualRate ? `${formatRate(actualRate)} task/hr` : 'No accepted work'} />
            <ForecastMetric label="Required pace" value={requiredRate ? `${formatRate(requiredRate)} task/hr` : 'No remaining work'} />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#2F2C2A]">Plan vs Accepted</p>
                <span className="text-sm font-semibold text-[#776B63]">{completionPct}%</span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[#FD7124]" style={{ width: `${completionPct}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <SmallStat label="Accepted" value={String(completedCount)} />
                <SmallStat label="In review" value={String(reviewTasks.length)} />
                <SmallStat label="Remaining" value={String(remainingCount)} />
              </div>
            </div>

            <div className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
              <ProjectPaceLineChart
                labels={chartSeries.labels}
                planned={chartSeries.planned}
                actual={chartSeries.actual}
                forecasted={chartSeries.forecasted}
                maxY={chartSeries.maxY}
                loading={loading}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[#F3D7C8] bg-[#FFF8F4] p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#2F2C2A]">Pace Inputs</p>
              <p className="mt-1 text-sm text-[#776B63]">Actual work vs plan.</p>
            </div>
            <TrendingUp size={19} className="text-[#FD7124]" />
          </div>
          <div className="mt-6 space-y-5">
            <VisualBar label="Pace ratio" value={paceRatio ? Math.round(Math.min(1.25, paceRatio) * 80) : 0} accent={paceRatio >= 1 ? 'bg-[#55936A]' : paceRatio >= 0.85 ? 'bg-[#FAA745]' : 'bg-[#CF5A4F]'} />
            <VisualBar label="Estimated hours used" value={totalEstimatedHours ? Math.round((observedWorkerHours / totalEstimatedHours) * 100) : 0} accent="bg-[#FD7124]" />
            <VisualBar label="Forecast health" value={modelReady ? 88 : 38} accent={modelReady ? 'bg-[#55936A]' : 'bg-[#FAA745]'} />
          </div>
          <div className="mt-5 rounded-2xl bg-white p-4">
            <p className="text-xs font-semibold uppercase text-[#A09188]">Chronos</p>
            <p className="mt-2 text-sm font-semibold text-[#2F2C2A]">{forecast?.futureProductivity ?? 'No model output yet'}</p>
            <p className="mt-2 text-xs leading-5 text-[#776B63]">
              {forecast?.modelStatus ?? 'PENDING'} / {forecast?.confidence ?? 'COLD_START'} / {formatHours(remainingEstimatedHours)} remaining estimate
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ForecastMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase text-[#A09188]">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-[#2F2C2A]">{value}</p>
    </div>
  );
}

function ProjectPaceLineChart({
  labels,
  planned,
  actual,
  forecasted,
  maxY,
  loading
}: {
  labels: string[];
  planned: number[];
  actual: Array<number | null>;
  forecasted: Array<number | null>;
  maxY: number;
  loading: boolean;
}) {
  const width = 420;
  const height = 180;
  const padding = { top: 18, right: 14, bottom: 34, left: 32 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const yTicks = [0, Math.ceil(maxY / 2), maxY];
  const xFor = (index: number) => padding.left + (plotWidth * index) / Math.max(1, labels.length - 1);
  const yFor = (value: number) => padding.top + plotHeight - (plotHeight * value) / Math.max(1, maxY);
  const plannedPath = makeLinePath(planned, xFor, yFor);
  const actualPath = makeNullableLinePath(actual, xFor, yFor);
  const forecastPath = makeNullableLinePath(forecasted, xFor, yFor);

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[#2F2C2A]">Workload vs actual work</p>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[#776B63]">
          <LegendDot color="bg-[#C95119]" label="Calculated workload" />
          <LegendDot color="bg-[#55936A]" label="Actual done" />
          <LegendDot color="bg-[#FAA745]" label="Forecast" />
        </div>
      </div>
      <div className="relative h-52">
        {loading ? (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-[#FFF8F4]/75">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#776B63]">
              <TrendingUp size={17} className="animate-pulse text-[#FD7124]" />
              Generating forecast
            </div>
          </div>
        ) : null}
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" role="img" aria-label="Project pace line graph">
          <rect x="0" y="0" width={width} height={height} rx="16" fill="#FFF8F4" />
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#F3D7C8" strokeWidth="1" />
              <text x={padding.left - 8} y={yFor(tick) + 4} textAnchor="end" fontSize="10" fontWeight="700" fill="#A09188">
                {tick}
              </text>
            </g>
          ))}
          {labels.map((label, index) => (
            <text key={label} x={xFor(index)} y={height - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#A09188">
              {label}
            </text>
          ))}
          <path d={plannedPath} fill="none" stroke="#C95119" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={actualPath} fill="none" stroke="#55936A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={forecastPath} fill="none" stroke="#FAA745" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 6" />
          {planned.map((value, index) => (
            <circle key={`planned-${index}`} cx={xFor(index)} cy={yFor(value)} r="3.5" fill="#C95119" stroke="#FFF8F4" strokeWidth="2" />
          ))}
          {actual.map((value, index) => value === null ? null : (
            <circle key={`actual-${index}`} cx={xFor(index)} cy={yFor(value)} r="3.8" fill="#55936A" stroke="#FFF8F4" strokeWidth="2" />
          ))}
          {forecasted.map((value, index) => value === null ? null : (
            <circle key={`forecast-${index}`} cx={xFor(index)} cy={yFor(value)} r="3.4" fill="#FAA745" stroke="#FFF8F4" strokeWidth="2" />
          ))}
        </svg>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-[#A09188]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#2F2C2A]">{value}</p>
    </div>
  );
}

function VisualBar({ label, value, accent }: { label: string; value: number; accent: string }) {
  const width = Math.max(0, Math.min(100, value));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-[#2F2C2A]">{label}</span>
        <span className="text-[#776B63]">{width}%</span>
      </div>
      <div className="h-3 rounded-full bg-white">
        <div className={`h-3 rounded-full ${accent}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function isSystemGeneratedTask(task: Task) {
  return task.id === 'iot-live-shift' || task.project === 'Kawal IoT Integration' || task.taskTemplate === 'Field safety operation';
}

function buildProjectPaceSeries(input: {
  plannedCount: number;
  completedCount: number;
  completedTasks: Task[];
  forecastValues: number[];
}) {
  const labels = ['-2d', '-1d', 'Today', '+1d', '+2d', '+3d'];
  const completedHistory = getCompletedHistory(input.completedTasks, input.completedCount);
  const remaining = Math.max(0, input.plannedCount - input.completedCount);
  const forecastWeights = input.forecastValues.slice(0, 3);
  const totalWeight = forecastWeights.reduce((sum, value) => sum + Math.max(0.01, value), 0);
  let projectedCompleted = input.completedCount;
  const forecasted: Array<number | null> = [null, null, input.completedCount];

  for (const value of forecastWeights) {
    const contribution = totalWeight > 0 ? (Math.max(0.01, value) / totalWeight) * remaining : remaining / 3;
    projectedCompleted = Math.min(input.plannedCount, projectedCompleted + contribution);
    forecasted.push(roundChartValue(projectedCompleted));
  }

  while (forecasted.length < labels.length) {
    projectedCompleted = Math.min(input.plannedCount, projectedCompleted + remaining / 3);
    forecasted.push(roundChartValue(projectedCompleted));
  }

  const planned = labels.map((_, index) => {
    if (!input.plannedCount) return 0;
    const progress = index / (labels.length - 1);
    return roundChartValue(Math.min(input.plannedCount, input.plannedCount * progress));
  });
  planned[2] = Math.max(planned[2], input.completedCount);
  planned[planned.length - 1] = input.plannedCount;

  const maxY = Math.max(
    1,
    Math.ceil(Math.max(...planned, ...completedHistory.map((value) => value ?? 0), ...forecasted.map((value) => value ?? 0)))
  );

  return {
    labels,
    planned,
    actual: completedHistory,
    forecasted,
    maxY
  };
}

function getCompletedHistory(completedTasks: Task[], completedCount: number): Array<number | null> {
  const today = startOfDay(new Date());
  const validCompletionDates = completedTasks
    .map((task) => task.completionProofSubmittedAt ? new Date(task.completionProofSubmittedAt) : null)
    .filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));

  if (validCompletionDates.length) {
    return [-2, -1, 0, null, null, null].map((offset) => {
      if (offset === null) return null;
      const end = new Date(today);
      end.setDate(today.getDate() + offset + 1);
      return validCompletionDates.filter((date) => date < end).length;
    });
  }

  return [
    Math.floor(completedCount * 0.35),
    Math.floor(completedCount * 0.7),
    completedCount,
    null,
    null,
    null
  ];
}

function makeLinePath(values: number[], xFor: (index: number) => number, yFor: (value: number) => number) {
  return values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(value)}`).join(' ');
}

function makeNullableLinePath(values: Array<number | null>, xFor: (index: number) => number, yFor: (value: number) => number) {
  let hasStarted = false;

  return values
    .map((value, index) => {
      if (value === null) {
        hasStarted = false;
        return '';
      }

      const command = hasStarted ? 'L' : 'M';
      hasStarted = true;
      return `${command} ${xFor(index)} ${yFor(value)}`;
    })
    .filter(Boolean)
    .join(' ');
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function roundChartValue(value: number) {
  return Math.round(value * 10) / 10;
}

function isTaskComplete(task: Task) {
  const status = task.status.toLowerCase();
  return status === 'done' || status === 'completed' || task.completionProofStatus === 'ACCEPTED';
}

function getTaskEstimatedHours(task: Task) {
  const hours = Number(task.schedulerRecommendation.totalWorkerHours);

  if (Number.isFinite(hours) && hours > 0) {
    return hours;
  }

  return 1;
}

function getObservedWorkerHours(completedTasks: Task[], projectTasks: Task[], workers: Worker[]) {
  const names = new Set(
    (completedTasks.length ? completedTasks : projectTasks)
      .map((task) => task.owner)
      .filter((owner) => owner && owner !== 'Unassigned')
  );
  const relevantWorkers = workers.filter((worker) => names.has(worker.name));
  const minutes = relevantWorkers.reduce((sum, worker) => sum + parseWorkerTimeMinutes(worker.time), 0);

  if (minutes > 0) {
    return Math.max(0.25, minutes / 60);
  }

  return completedTasks.reduce((sum, task) => sum + getTaskEstimatedHours(task), 0);
}

function getPaceStatus(plannedCount: number, completedCount: number, paceRatio: number) {
  if (!plannedCount) return 'No Plan';
  if (completedCount === plannedCount) return 'Complete';
  if (!completedCount) return 'Baseline Pending';
  if (paceRatio >= 1) return 'On Pace';
  if (paceRatio >= 0.85) return 'Watch';
  return 'Behind Pace';
}

function getPaceClass(status: string) {
  if (status === 'On Pace' || status === 'Complete') return 'bg-[#EAF5ED] text-[#3F7A54]';
  if (status === 'Watch' || status === 'Baseline Pending') return 'bg-[#FFF4DC] text-[#8A4B02]';
  if (status === 'Behind Pace') return 'bg-[#FFEFE6] text-[#B84011]';
  return 'bg-[#F1F2F7] text-[#5F5A56]';
}

function getPaceRecommendation(input: {
  plannedCount: number;
  completedCount: number;
  actualRate: number;
  requiredRate: number;
  rejectedCount: number;
  suggestedAdditionalCrew: number;
}) {
  if (!input.plannedCount) {
    return 'Create project tasks to build the plan baseline.';
  }

  if (!input.completedCount) {
    return 'Waiting for accepted completion proof to measure actual productivity.';
  }

  if (input.rejectedCount > 0) {
    return `${input.rejectedCount} rejected proof item${input.rejectedCount > 1 ? 's are' : ' is'} dragging project pace. Reduce rework first.`;
  }

  if (input.requiredRate && input.actualRate < input.requiredRate) {
    return input.suggestedAdditionalCrew > 0
      ? `Current pace is below plan. Add ${input.suggestedAdditionalCrew} worker${input.suggestedAdditionalCrew > 1 ? 's' : ''} or move start earlier.`
      : 'Current pace is below plan. Prioritize assignments with the highest remaining estimated hours.';
  }

  return 'Actual productivity is meeting the required project pace.';
}

function formatRate(value: number) {
  return value >= 1 ? value.toFixed(1) : value.toFixed(2);
}

function formatHours(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0h';
  }

  return value >= 10 ? `${Math.round(value)}h` : `${value.toFixed(1)}h`;
}

function FocusCard({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#FD7124]">
        <Icon size={18} />
      </span>
      <p className="mt-4 text-sm font-semibold text-[#2F2C2A]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#2F2C2A]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#776B63]">{detail}</p>
    </div>
  );
}

function parseWorkerTimeMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);

  if (Number.isFinite(hours) && Number.isFinite(minutes)) {
    return hours * 60 + minutes;
  }

  const hourMatch = value.match(/(\d+)\s*h/i);
  const minuteMatch = value.match(/(\d+)\s*m/i);
  return (hourMatch ? Number(hourMatch[1]) * 60 : 0) + (minuteMatch ? Number(minuteMatch[1]) : 0);
}
