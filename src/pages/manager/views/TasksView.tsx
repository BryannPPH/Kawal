import { ClipboardCheck, ClipboardList, Clock, ShieldAlert } from 'lucide-react';
import { Pill } from '../../../components/ui/Pill';
import { toneStyles } from '../../../constants/workforce';
import type { Task } from '../../../types/workforce';
import { MetricCard } from '../components/MetricCard';
import { TaskPanel } from '../components/TaskPanel';

export function TasksView({ tasks }: { tasks: Task[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Total Tasks" value={String(tasks.length)} detail="Active operational tasks" icon={ClipboardList} />
          <MetricCard label="Ready Review" value="1" detail="Proof waiting approval" icon={ClipboardCheck} />
          <MetricCard label="Safety Open" value="1" detail="Needs supervisor action" icon={ShieldAlert} />
        </div>

        <section className="rounded-lg border border-[#F3D7C8] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#2F2C2A]">Task Timeline</p>
              <p className="mt-1 text-sm text-[#776B63]">Operational tasks grouped by priority and ownership.</p>
            </div>
            <Clock size={18} className="text-[#FAA745]" />
          </div>

          <div className="mt-5 space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-[#F3D7C8] p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_110px_110px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#2F2C2A]">{task.taskTemplate}</p>
                    <p className="mt-1 text-sm text-[#776B63]">{task.project} / {task.owner}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#5F5A56]">{task.zone}</p>
                  <Pill className={toneStyles[task.tone]}>{task.priority || task.status}</Pill>
                  <p className="text-sm font-semibold text-[#5F5A56]">Due {task.deadline}</p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <Info label="Quantity" value={`${task.quantity} ${task.unit}`} />
                  <Info label="Workers" value={String(task.schedulerRecommendation.recommendedWorkerCount)} />
                  <Info label="Duration" value={task.schedulerRecommendation.estimatedTaskDuration} />
                  <Info label="Feasibility" value={task.schedulerRecommendation.deadlineFeasibilityStatus} />
                </div>

                <div className="mt-4 rounded-md bg-[#FFF8F4] p-3">
                  <p className="text-xs font-semibold uppercase text-[#A09188]">Scheduler Placeholder</p>
                  <p className="mt-2 text-sm leading-6 text-[#776B63]">
                    Start {task.schedulerRecommendation.recommendedStartTime}; complete {task.schedulerRecommendation.estimatedCompletionTime}; productivity {task.schedulerRecommendation.expectedProductivityRate}.
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {task.schedulerRecommendation.selectedWorkerRecommendations.map((worker) => (
                      <div key={worker.workerId} className="rounded-md border border-[#F3D7C8] bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-[#2F2C2A]">{worker.workerName}</p>
                        <p className="mt-1 text-xs leading-5 text-[#776B63]">{worker.explanation}</p>
                      </div>
                    ))}
                  </div>
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
