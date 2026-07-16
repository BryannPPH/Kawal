import { Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import type { Worker } from '../../../types/workforce';

type AssignmentPanelProps = {
  selectedWorker: Worker;
  onSelectWorker: (worker: Worker) => void;
};

export function AssignmentPanel({ selectedWorker, onSelectWorker }: AssignmentPanelProps) {
  const [approved, setApproved] = useState(false);

  return (
    <section className="rounded-2xl border border-[#F3D7C8] bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#2F2C2A]">Recommended Assignment</p>
          <p className="mt-1 text-sm text-[#776B63]">Best fit for steel installation based on availability, certification, distance, and fatigue.</p>
        </div>
        <Button variant="primary" onClick={() => setApproved(true)}>
          <Check size={16} />
          {approved ? 'Approved' : 'Approve'}
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <button
          type="button"
          onClick={() => onSelectWorker(selectedWorker)}
          className="flex min-h-[96px] items-center gap-4 rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4 text-left"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#FD7124] text-sm font-bold text-white">
            {selectedWorker.name
              .split(' ')
              .map((word) => word[0])
              .join('')
              .slice(0, 2)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-[#2F2C2A]">{selectedWorker.name}</span>
            <span className="mt-1 block text-sm text-[#776B63]">{selectedWorker.role} · {selectedWorker.zone}</span>
            <span className="mt-3 block h-2 rounded-full bg-[#F5D8C8]">
              <span className="block h-2 rounded-full bg-[#FD7124]" style={{ width: `${selectedWorker.match}%` }} />
            </span>
          </span>
          <span className="text-right">
            <span className="block text-2xl font-semibold text-[#2F2C2A]">{selectedWorker.match}%</span>
            <span className="text-xs font-medium text-[#776B63]">match</span>
          </span>
        </button>

        <div className="grid grid-cols-2 gap-3">
          {[
            ['Certified', 96],
            ['Available', 92],
            ['Nearby', 88],
            ['Fatigue OK', 91]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#F3D7C8] p-3">
              <p className="text-xs font-medium text-[#776B63]">{label}</p>
              <p className="mt-1 text-lg font-semibold text-[#2F2C2A]">{value}%</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
