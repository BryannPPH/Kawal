import { Check } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Pill } from '../../../components/ui/Pill';
import { toneStyles } from '../../../constants/workforce';
import type { Task, Worker } from '../../../types/workforce';

type AssignmentPanelProps = {
  selectedWorker: Worker;
  task?: Task;
  busy: boolean;
  error: string | null;
  onSelectWorker: (worker: Worker) => void;
  onAssign: () => void;
};

export function AssignmentPanel({ selectedWorker, task, busy, error, onSelectWorker, onAssign }: AssignmentPanelProps) {
  return (
    <section className="rounded-lg border border-[#F3D7C8] bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#2F2C2A]">Recommended Assignment</p>
          <p className="mt-1 text-sm text-[#776B63]">
            Dispatch writes to the shared database, then appears in the worker app for acceptance.
          </p>
        </div>
        <Button variant="primary" onClick={onAssign} disabled={!task || busy}>
          <Check size={16} />
          {busy ? 'Assigning' : task ? 'Assign Worker' : 'No Open Task'}
        </Button>
      </div>

      {error ? <p className="mt-4 rounded-md bg-[#FFEFE6] px-3 py-2 text-sm font-semibold text-[#B84011]">{error}</p> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <button
          type="button"
          onClick={() => onSelectWorker(selectedWorker)}
          className="flex min-h-[96px] items-center gap-4 rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] p-4 text-left"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-[#FD7124] text-sm font-bold text-white">
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

        <div className="rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] p-4">
          {task ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#2F2C2A]">{task.title}</p>
                  <p className="mt-1 text-xs text-[#776B63]">{task.project} / {task.zone}</p>
                </div>
                <Pill className={toneStyles[task.tone]}>{task.status}</Pill>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniMetric label="Priority" value={task.priority} />
                <MiniMetric label="Qty" value={`${task.quantity} ${task.unit}`} />
                <MiniMetric label="Owner" value={task.owner} />
                <MiniMetric label="Due" value={task.deadline} />
              </div>
            </>
          ) : (
            <p className="text-sm font-semibold text-[#776B63]">No task is ready for dispatch.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-[#A09188]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#2F2C2A]">{value}</p>
    </div>
  );
}
