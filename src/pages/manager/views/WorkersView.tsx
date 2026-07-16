import { TimerReset, UserCheck, Users } from 'lucide-react';
import type { Worker } from '../../../types/workforce';
import { WorkerBoard } from '../components/WorkerBoard';

type WorkersViewProps = {
  workers: Worker[];
  selectedWorker: Worker;
  onSelectWorker: (worker: Worker) => void;
};

export function WorkersView({ workers, selectedWorker, onSelectWorker }: WorkersViewProps) {
  const workingCount = workers.filter((worker) => worker.status === 'working').length;
  const breakCount = workers.filter((worker) => worker.status === 'break').length;
  const waitingCount = workers.filter((worker) => worker.status === 'waiting').length;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[#F3D7C8] bg-white p-6 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-[#C95119]">Crew Overview</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-[#2F2C2A]">See availability before choosing a worker.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#776B63]">The page now starts with a simple crew state instead of asking managers to scan every row immediately.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <CrewStat icon={Users} label="On site" value={workers.length} />
            <CrewStat icon={UserCheck} label="Working" value={workingCount} />
            <CrewStat icon={TimerReset} label="Break" value={breakCount} />
          </div>
        </div>
      </section>

      <WorkerBoard workers={workers} selectedWorker={selectedWorker} onSelectWorker={onSelectWorker} />

      <section className="rounded-2xl border border-[#F3D7C8] bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Crew Coverage</p>
            <p className="mt-1 text-sm text-[#776B63]">{waitingCount} workers are waiting for assignment.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {['Steel Crew', 'Safety Support', 'Inspector'].map((role, index) => (
            <div key={role} className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-5">
              <p className="text-sm font-semibold text-[#2F2C2A]">{role}</p>
              <div className="mt-5 flex items-end gap-2">
                <p className="text-4xl font-semibold text-[#FD7124]">{[3, 2, 1][index]}</p>
                <p className="pb-1 text-sm text-[#776B63]">available</p>
              </div>
              <div className="mt-4 h-2 rounded-full bg-white">
                <div className="h-2 rounded-full bg-[#FD7124]" style={{ width: `${[78, 54, 32][index]}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CrewStat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#FFF8F4] p-4 text-center">
      <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white text-[#FD7124]">
        <Icon size={17} />
      </span>
      <p className="mt-3 text-3xl font-semibold text-[#2F2C2A]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#776B63]">{label}</p>
    </div>
  );
}
