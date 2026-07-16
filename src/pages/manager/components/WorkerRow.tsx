import { Pill } from '../../../components/ui/Pill';
import { statusLabels, statusStyles } from '../../../constants/workforce';
import type { Worker } from '../../../types/workforce';

type WorkerRowProps = {
  worker: Worker;
  selected: boolean;
  onSelect: (worker: Worker) => void;
};

export function WorkerRow({ worker, selected, onSelect }: WorkerRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(worker)}
      className={`grid w-full grid-cols-1 items-center gap-4 rounded-lg border bg-white p-4 text-left transition hover:border-[#FAA745] hover:bg-[#FFF8F4] md:grid-cols-[minmax(180px,1.3fr)_120px_130px_130px_110px] ${
        selected ? 'border-[#FD7124] ring-2 ring-[#FFEFE6]' : 'border-[#F3D7C8]'
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#FFEFE6] text-sm font-semibold text-[#C95119]">
          {worker.name
            .split(' ')
            .map((word) => word[0])
            .join('')
            .slice(0, 2)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[#2F2C2A]">{worker.name}</span>
          <span className="mt-1 block truncate text-sm text-[#776B63]">{worker.task}</span>
        </span>
      </span>

      <span>
        <span className="block text-xs font-medium text-[#A09188]">Status</span>
        <Pill className={statusStyles[worker.status]}>{statusLabels[worker.status]}</Pill>
      </span>

      <span>
        <span className="block text-xs font-medium text-[#A09188]">Zone / Time</span>
        <span className="mt-1 block text-sm font-semibold text-[#3D3835]">{worker.zone} · {worker.time}</span>
      </span>

      <span>
        <span className="flex justify-between text-xs font-medium text-[#A09188]">
          <span>Fatigue</span>
          <span>{worker.fatigue}%</span>
        </span>
        <span className="mt-2 block h-2 rounded-full bg-[#F5D8C8]">
          <span
            className={`block h-2 rounded-full ${worker.fatigue >= 55 ? 'bg-[#FAA745]' : 'bg-[#FD7124]'}`}
            style={{ width: `${worker.fatigue}%` }}
          />
        </span>
      </span>

      <span className="text-left md:text-right">
        <span className="block text-xs font-medium text-[#A09188]">Pay</span>
        <span className="mt-1 block text-sm font-semibold text-[#2F2C2A]">{worker.pay}</span>
      </span>
    </button>
  );
}
