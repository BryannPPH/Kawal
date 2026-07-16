import { useMemo, useState } from 'react';
import { statusLabels } from '../../../constants/workforce';
import type { Worker, WorkerStatus } from '../../../types/workforce';
import { WorkerRow } from './WorkerRow';

type WorkerBoardProps = {
  workers: Worker[];
  selectedWorker: Worker;
  onSelectWorker: (worker: Worker) => void;
};

export function WorkerBoard({ workers, selectedWorker, onSelectWorker }: WorkerBoardProps) {
  const [filter, setFilter] = useState<WorkerStatus | 'all'>('all');
  const visibleWorkers = useMemo(() => workers.filter((worker) => filter === 'all' || worker.status === filter), [filter]);
  const statusSummary = (['working', 'waiting', 'break', 'done'] as const).map((status) => ({
    status,
    count: workers.filter((worker) => worker.status === status).length
  }));

  return (
    <section className="rounded-2xl border border-[#F3D7C8] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#2F2C2A]">Worker Dispatch</p>
          <p className="mt-1 text-sm text-[#776B63]">A lighter board for availability, fatigue, and current assignment.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'working', 'waiting', 'break', 'done'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`h-9 rounded-xl px-3 text-sm font-semibold transition ${
                filter === item ? 'bg-[#FD7124] text-white' : 'border border-[#F3D7C8] bg-white text-[#5F5A56] hover:bg-[#FFEFE6]'
              }`}
            >
              {item === 'all' ? 'All' : statusLabels[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {statusSummary.map(({ status, count }) => {
          const percent = workers.length ? Math.round((count / workers.length) * 100) : 0;

          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded-2xl border p-3 text-left transition ${
                filter === status ? 'border-[#FD7124] bg-[#FFEFE6]' : 'border-[#F3D7C8] bg-[#FFF8F4] hover:bg-[#FFEFE6]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#776B63]">{statusLabels[status]}</p>
                <p className="text-sm font-semibold text-[#2F2C2A]">{count}</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white">
                <div className="h-2 rounded-full bg-[#FD7124]" style={{ width: `${percent}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4">
        {visibleWorkers.map((worker) => (
          <WorkerRow key={worker.id} worker={worker} selected={selectedWorker.id === worker.id} onSelect={onSelectWorker} />
        ))}
      </div>
    </section>
  );
}
