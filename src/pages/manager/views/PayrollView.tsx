import { Calculator, CheckCircle2, Clock3, WalletCards } from 'lucide-react';
import type { Worker } from '../../../types/workforce';

export function PayrollView({ workers }: { workers: Worker[] }) {
  const reviewCount = workers.filter((worker) => worker.status === 'done').length;
  const totalWorkedMinutes = workers.reduce((sum, worker) => sum + timeToMinutes(worker.time), 0);
  const completedTaskCount = workers.reduce((sum, worker) => sum + completedTasksFor(worker), 0);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-[#F3D7C8] bg-white">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="p-6 sm:p-7">
            <p className="text-sm font-semibold text-[#C95119]">Payroll</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-[#2F2C2A]">Pay review without the clutter.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#776B63]">Keep earnings, bonus pool, and proof review visible before opening worker-level detail.</p>
          </div>
          <div className="border-t border-[#F3D7C8] bg-[#FFF8F4] p-6 lg:border-l lg:border-t-0">
            <div className="grid grid-cols-2 gap-3">
              <PayrollStat icon={WalletCards} label="Shift payroll" value="Rp900k" />
              <PayrollStat icon={Calculator} label="Bonus pool" value="Rp120k" />
            </div>
            <div className="mt-4 rounded-2xl bg-white p-4">
              <p className="text-sm font-semibold text-[#2F2C2A]">{formatWorkedTime(totalWorkedMinutes)} logged today</p>
              <p className="mt-1 text-xs font-semibold text-[#776B63]">{completedTaskCount} completed tasks</p>
              <div className="mt-3 h-2 rounded-full bg-[#F5D8C8]">
                <div className="h-2 rounded-full bg-[#FD7124]" style={{ width: `${workers.length ? Math.round((reviewCount / workers.length) * 100) : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#F3D7C8] bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Payroll Detail</p>
            <p className="mt-1 text-sm text-[#776B63]">Worker earnings grouped by logged hours and completed tasks.</p>
          </div>
          <p className="text-sm font-semibold text-[#FD7124]">Today</p>
        </div>

        <div className="mt-5 grid gap-3">
          {workers.map((worker) => {
            const workedMinutes = timeToMinutes(worker.time);
            const completedTasks = completedTasksFor(worker);

            return (
              <div key={worker.id} className="grid gap-4 rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4 md:grid-cols-[minmax(0,1.4fr)_180px_180px_120px] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#2F2C2A]">{worker.name}</p>
                  <p className="mt-1 truncate text-sm text-[#776B63]">{worker.task}</p>
                </div>
                <PayrollChip icon={Clock3} label="Total hours" value={formatWorkedTime(workedMinutes)} />
                <PayrollChip icon={CheckCircle2} label="Completed" value={`${completedTasks} task${completedTasks === 1 ? '' : 's'}`} />
                <p className="text-left text-sm font-semibold text-[#2F2C2A] md:text-right">{worker.pay}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PayrollChip({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFEFE6] text-[#FD7124]">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-[#A09188]">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-[#2F2C2A]">{value}</p>
      </div>
    </div>
  );
}

function PayrollStat({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFEFE6] text-[#FD7124]">
        <Icon size={16} />
      </span>
      <p className="mt-4 text-2xl font-semibold text-[#2F2C2A]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#776B63]">{label}</p>
    </div>
  );
}

function timeToMinutes(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':');
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
}

function formatWorkedTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function completedTasksFor(worker: Worker) {
  return worker.status === 'done' ? 1 : 0;
}
