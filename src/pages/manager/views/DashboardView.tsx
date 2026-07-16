import { Activity, Check, ClipboardList, ShieldAlert, TimerReset, Users } from 'lucide-react';
import type { Task, Worker } from '../../../types/workforce';
import { AssignmentPanel } from '../components/AssignmentPanel';
import { MetricCard } from '../components/MetricCard';
import { WorkerBoard } from '../components/WorkerBoard';

type DashboardViewProps = {
  selectedWorker: Worker;
  workers: Worker[];
  tasks: Task[];
  onSelectWorker: (worker: Worker) => void;
};

export function DashboardView({ selectedWorker, workers, tasks, onSelectWorker }: DashboardViewProps) {
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

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-[#F3D7C8] bg-white">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#C95119]">Live shift snapshot</p>
                <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal text-[#2F2C2A]">Keep the site moving without overloading the crew.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#776B63]">A simplified view of task flow, fatigue pressure, and worker availability for the current shift.</p>
              </div>
              <span className="hidden rounded-xl bg-[#FFEFE6] px-3 py-1 text-xs font-semibold text-[#C95119] sm:inline-flex">Live</span>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-3">
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
            <p className="mt-1 text-sm text-[#776B63]">Three calm signals for managers before they open the detailed pages.</p>
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
        <AssignmentPanel selectedWorker={selectedWorker} onSelectWorker={onSelectWorker} />
        <WorkerBoard workers={workers} selectedWorker={selectedWorker} onSelectWorker={onSelectWorker} />
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
