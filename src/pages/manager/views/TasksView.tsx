import { ClipboardCheck, ClipboardList, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Pill } from '../../../components/ui/Pill';
import { toneStyles } from '../../../constants/workforce';
import type { Task, Worker } from '../../../types/workforce';
import { MetricCard } from '../components/MetricCard';
import { TaskPanel } from '../components/TaskPanel';

type TasksViewProps = {
  tasks: Task[];
  workers: Worker[];
  selectedWorker: Worker;
  assignmentBusy: string | null;
  assignmentError: string | null;
  onSelectWorker: (worker: Worker) => void;
  onAssignTask: (taskId: string, workerId?: string) => void;
};

export function TasksView({
  tasks,
  workers,
  selectedWorker,
  assignmentBusy,
  assignmentError,
  onSelectWorker,
  onAssignTask
}: TasksViewProps) {
  const reviewCount = tasks.filter((task) => task.status === 'Review').length;
  const safetyOpenCount = tasks.filter((task) => task.tone === 'danger' || task.priority === 'Critical').length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Total Tasks" value={String(tasks.length)} detail="Active operational tasks" icon={ClipboardList} />
          <MetricCard label="Ready Review" value={String(reviewCount)} detail="Proof waiting approval" icon={ClipboardCheck} />
          <MetricCard label="Safety Open" value={String(safetyOpenCount)} detail="Needs supervisor action" icon={ShieldAlert} />
        </div>

        <section className="rounded-lg border border-[#F3D7C8] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#2F2C2A]">Task Timeline</p>
              <p className="mt-1 text-sm text-[#776B63]">Operational tasks grouped by priority and ownership.</p>
            </div>
            <Clock size={18} className="text-[#FAA745]" />
          </div>

          {assignmentError ? <p className="mt-4 rounded-md bg-[#FFEFE6] px-3 py-2 text-sm font-semibold text-[#B84011]">{assignmentError}</p> : null}

          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#A09188]">Dispatch to</p>
              <p className="mt-1 text-sm font-semibold text-[#2F2C2A]">{selectedWorker.name}</p>
            </div>
            <select
              value={selectedWorker.id}
              onChange={(event) => {
                const worker = workers.find((item) => item.id === event.target.value);
                if (worker) onSelectWorker(worker);
              }}
              className="field-input h-10 bg-white sm:w-64"
            >
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>{worker.name} / {worker.status}</option>
              ))}
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-[#F3D7C8] p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_110px_110px_132px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#2F2C2A]">{task.taskTemplate}</p>
                    <p className="mt-1 text-sm text-[#776B63]">{task.project} / {task.owner}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#5F5A56]">{task.zone}</p>
                  <Pill className={toneStyles[task.tone]}>{task.priority || task.status}</Pill>
                  <p className="text-sm font-semibold text-[#5F5A56]">Due {task.deadline}</p>
                  <Button
                    variant={task.status === 'Open' ? 'primary' : 'secondary'}
                    disabled={assignmentBusy === task.id || task.status === 'Review' || task.status === 'Done'}
                    onClick={() => onAssignTask(task.id, selectedWorker.id)}
                  >
                    {assignmentBusy === task.id ? 'Assigning' : task.status === 'Open' || task.owner === 'Unassigned' ? 'Assign' : 'Reassign'}
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <Info label="Quantity" value={`${task.quantity} ${task.unit}`} />
                  <Info label="Workload" value={task.workload || '-'} />
                  <Info label="Temp / Humidity" value={`${task.temperatureC ?? '-'}C / ${task.humidityPct ?? '-'}%`} />
                  <Info label="Worker-hours" value={String(task.schedulerRecommendation.totalWorkerHours)} />
                  <Info label="Crew size" value={String(task.schedulerRecommendation.recommendedCrewSize)} />
                  <Info label="Duration" value={task.schedulerRecommendation.estimatedDuration} />
                  <Info label="Feasibility" value={task.schedulerRecommendation.deadlineFeasibilityStatus} />
                </div>

                <div className="mt-4 rounded-md bg-[#FFF8F4] p-3">
                  <p className="text-xs font-semibold uppercase text-[#A09188]">Scheduler Engines</p>
                  <p className="mt-2 text-sm leading-6 text-[#776B63]">
                    Start {task.schedulerRecommendation.recommendedStartTime}; finish {formatFinishTime(task.schedulerRecommendation.estimatedFinishTime)}; productivity {task.schedulerRecommendation.expectedProductivityRate}.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <Info label="Chronos productivity" value={task.schedulerRecommendation.chronosForecast.futureProductivity} />
                    <Info label="Delay prediction" value={task.schedulerRecommendation.chronosForecast.delayPrediction} />
                    <Info label="Add crew" value={String(task.schedulerRecommendation.chronosForecast.suggestedAdditionalCrew)} />
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {task.schedulerRecommendation.selectedWorkerRecommendations.map((worker) => (
                      <div key={worker.workerId} className="rounded-md border border-[#F3D7C8] bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-[#2F2C2A]">{worker.workerName}</p>
                        <p className="mt-1 text-xs leading-5 text-[#776B63]">{worker.explanation}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-[#776B63]">
                    Model status: {task.schedulerRecommendation.chronosForecast.modelStatus === 'UNAVAILABLE' ? 'Failed' : 'Ready'} / Forecast confidence: {task.schedulerRecommendation.chronosForecast.confidence ?? 'INFERRED'}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-[#C95119]">{task.schedulerRecommendation.schedulerStatus}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <TaskPanel tasks={tasks} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#FFF8F4] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-[#A09188]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#2F2C2A]">{value}</p>
    </div>
  );
}

function formatFinishTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
