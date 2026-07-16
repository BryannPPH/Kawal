import { Calculator, WalletCards } from 'lucide-react';
import type { Worker } from '../../../types/workforce';

export function PayrollView({ workers }: { workers: Worker[] }) {
  const reviewCount = workers.filter((worker) => worker.status === 'done').length;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-lg border border-[#F3D7C8] bg-white">
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
            <div className="mt-4 rounded-lg bg-white p-4">
              <p className="text-sm font-semibold text-[#2F2C2A]">{reviewCount} proofs ready for review</p>
              <div className="mt-3 h-2 rounded-full bg-[#F5D8C8]">
                <div className="h-2 rounded-full bg-[#FD7124]" style={{ width: `${workers.length ? Math.round((reviewCount / workers.length) * 100) : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#F3D7C8] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Payroll Detail</p>
            <p className="mt-1 text-sm text-[#776B63]">Worker earnings by assignment, status, and fatigue score.</p>
          </div>
          <p className="text-sm font-semibold text-[#FD7124]">Today</p>
        </div>

        <div className="mt-5 grid gap-3">
          {workers.map((worker) => (
            <div key={worker.id} className="grid gap-4 rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] p-4 md:grid-cols-[minmax(0,1.4fr)_120px_180px_120px] md:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#2F2C2A]">{worker.name}</p>
                <p className="mt-1 truncate text-sm text-[#776B63]">{worker.task}</p>
              </div>
              <p className="text-sm font-semibold capitalize text-[#5F5A56]">{worker.status}</p>
              <div>
                <div className="flex justify-between text-xs text-[#776B63]">
                  <span>Fatigue</span>
                  <span>{worker.fatigue}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full bg-[#FAA745]" style={{ width: `${worker.fatigue}%` }} />
                </div>
              </div>
              <p className="text-left text-sm font-semibold text-[#2F2C2A] md:text-right">{worker.pay}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PayrollStat({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-[#FFEFE6] text-[#FD7124]">
        <Icon size={16} />
      </span>
      <p className="mt-4 text-2xl font-semibold text-[#2F2C2A]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#776B63]">{label}</p>
    </div>
  );
}
