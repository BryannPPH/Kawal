import { Activity, Check, ClipboardList, ShieldAlert, TimerReset, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Task, Worker } from '../../../types/workforce';
import { AssignmentPanel } from '../components/AssignmentPanel';
import { MetricCard } from '../components/MetricCard';
import { WorkerBoard } from '../components/WorkerBoard';

type DashboardViewProps = {
  selectedWorker: Worker;
  workers: Worker[];
  tasks: Task[];
  onSelectWorker: (worker: Worker) => void;
  onAutoAssign: (taskId: string) => Promise<Task>;
};

export function DashboardView({ selectedWorker, workers, tasks, onSelectWorker, onAutoAssign }: DashboardViewProps) {
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const workingCount = workers.filter((worker) => worker.status === 'working').length;
  const breakCount = workers.filter((worker) => worker.status === 'break').length;
  const waitingCount = workers.filter((worker) => worker.status === 'waiting').length;
  const reviewCount = tasks.filter((task) => task.status.toLowerCase().includes('review')).length;
  const openTaskCount = tasks.filter((task) => !['done', 'completed'].includes(task.status.toLowerCase())).length;
  const averageFatigue = workers.length ? Math.round(workers.reduce((sum, worker) => sum + worker.fatigue, 0) / workers.length) : 0;
  const completionPct = tasks.length ? Math.round(((tasks.length - openTaskCount) / tasks.length) * 100) : 0;
  const visualMetrics = [
    { label: 'Crew in motion', value: String(workingCount), detail: `${waitingCount} waiting assignment`, icon: Users },
    { label: 'Open tasks', value: String(openTaskCount), detail: `${reviewCount} ready for review`, icon: ClipboardList },
    { label: 'Avg fatigue', value: `${averageFatigue}%`, detail: `${breakCount} currently on break`, icon: ShieldAlert }
  ];
  const recommendedTask = useMemo(() => {
    const unassignedTasks = tasks.filter((task) => task.owner === 'Unassigned');
    return unassignedTasks.find((task) => task.schedulerRecommendation.selectedWorkerRecommendations.length > 0) ?? unassignedTasks[0] ?? null;
  }, [tasks]);
  const recommendedWorkerId = recommendedTask?.schedulerRecommendation.selectedWorkerRecommendations[0]?.workerId;
  const recommendedWorker = workers.find((worker) => worker.id === recommendedWorkerId) ?? selectedWorker;

  const approveRecommendedAssignment = async () => {
    if (!recommendedTask) {
      return;
    }

    setAssigningTaskId(recommendedTask.id);
    setAssignmentError(null);

    try {
      await onAutoAssign(recommendedTask.id);
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <AssignmentPanel
          selectedWorker={recommendedWorker}
          task={recommendedTask}
          assigning={Boolean(recommendedTask && assigningTaskId === recommendedTask.id)}
          error={assignmentError}
          onSelectWorker={onSelectWorker}
          onApprove={approveRecommendedAssignment}
        />
        <WorkerBoard workers={workers} selectedWorker={selectedWorker} onSelectWorker={onSelectWorker} compact />
      </section>
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
