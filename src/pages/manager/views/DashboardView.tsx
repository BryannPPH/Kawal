import { Check, ClipboardList, ShieldAlert, Users } from 'lucide-react';
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

const metrics = [
  { label: 'Active Workers', value: '84', detail: '11 currently on break', icon: Users },
  { label: 'Open Tasks', value: '128', detail: '14 waiting review', icon: ClipboardList },
  { label: 'Completion', value: '67%', detail: 'Today across all zones', icon: Check },
  { label: 'High Risk', value: '6', detail: '2 fewer than yesterday', icon: ShieldAlert }
];

export function DashboardView({ selectedWorker, workers, tasks, onSelectWorker }: DashboardViewProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#F3D7C8] bg-white/65 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Shift Overview</p>
            <p className="mt-1 text-sm text-[#776B63]">Core health signals for today&apos;s operation.</p>
          </div>
          <span className="hidden rounded-md bg-[#FFEFE6] px-3 py-1 text-xs font-semibold text-[#C95119] sm:inline-flex">Live</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((item) => (
            <MetricCard key={item.label} {...item} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#F3D7C8] bg-white/65 p-4">
        <div className="mb-4">
          <p className="text-sm font-semibold text-[#2F2C2A]">Dispatch Workflow</p>
          <p className="mt-1 text-sm text-[#776B63]">Recommended assignment and worker availability are grouped in one operational flow.</p>
        </div>
        <div className="space-y-4">
          <AssignmentPanel selectedWorker={selectedWorker} onSelectWorker={onSelectWorker} />
          <WorkerBoard workers={workers} selectedWorker={selectedWorker} onSelectWorker={onSelectWorker} />
        </div>
      </section>
    </div>
  );
}
