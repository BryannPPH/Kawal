import { TimerReset, UserCheck, Users } from 'lucide-react';
import { workers } from '../../../constants/workforce';
import type { Worker } from '../../../types/workforce';
import { MetricCard } from '../components/MetricCard';
import { WorkerBoard } from '../components/WorkerBoard';

type WorkersViewProps = {
  selectedWorker: Worker;
  onSelectWorker: (worker: Worker) => void;
};

export function WorkersView({ selectedWorker, onSelectWorker }: WorkersViewProps) {
  const workingCount = workers.filter((worker) => worker.status === 'working').length;
  const breakCount = workers.filter((worker) => worker.status === 'break').length;
  const waitingCount = workers.filter((worker) => worker.status === 'waiting').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="On Site" value={String(workers.length)} detail="Tracked workers in this shift" icon={Users} />
        <MetricCard label="Working Now" value={String(workingCount)} detail={`${waitingCount} waiting assignment`} icon={UserCheck} />
        <MetricCard label="Break Queue" value={String(breakCount)} detail="Fatigue and rest monitoring" icon={TimerReset} />
      </div>

      <WorkerBoard selectedWorker={selectedWorker} onSelectWorker={onSelectWorker} />

      <section className="rounded-lg border border-[#F3D7C8] bg-white p-5">
        <p className="text-sm font-semibold text-[#2F2C2A]">Crew Coverage</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {['Steel Crew', 'Safety Support', 'Inspector'].map((role, index) => (
            <div key={role} className="rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] p-4">
              <p className="text-sm font-semibold text-[#2F2C2A]">{role}</p>
              <p className="mt-2 text-2xl font-semibold text-[#FD7124]">{[3, 2, 1][index]}</p>
              <p className="mt-1 text-sm text-[#776B63]">Available for assignment</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
