import { useMemo, useState } from 'react';
import { statusLabels, workers } from '../../../constants/workforce';
import type { Worker, WorkerStatus } from '../../../types/workforce';
import { WorkerRow } from './WorkerRow';

type WorkerBoardProps = {
  selectedWorker: Worker;
  onSelectWorker: (worker: Worker) => void;
};

export function WorkerBoard({ selectedWorker, onSelectWorker }: WorkerBoardProps) {
  const [filter, setFilter] = useState<WorkerStatus | 'all'>('all');
  const visibleWorkers = useMemo(() => workers.filter((worker) => filter === 'all' || worker.status === filter), [filter]);

  return (
    <section className="rounded-lg border border-[#F3D7C8] bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#2F2C2A]">Worker Dispatch</p>
          <p className="mt-1 text-sm text-[#776B63]">Long rows show the key operational details without crowding the board.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'working', 'waiting', 'break', 'done'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`h-9 rounded-md px-3 text-sm font-semibold transition ${
                filter === item ? 'bg-[#FD7124] text-white' : 'border border-[#F3D7C8] bg-white text-[#5F5A56] hover:bg-[#FFEFE6]'
              }`}
            >
              {item === 'all' ? 'All' : statusLabels[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {visibleWorkers.map((worker) => (
          <WorkerRow key={worker.id} worker={worker} selected={selectedWorker.id === worker.id} onSelect={onSelectWorker} />
        ))}
      </div>
    </section>
  );
}
