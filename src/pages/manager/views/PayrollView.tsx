import { Calculator, WalletCards } from 'lucide-react';
import type { Worker } from '../../../types/workforce';
import { MetricCard } from '../components/MetricCard';

export function PayrollView({ workers }: { workers: Worker[] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Shift Payroll" value="Rp900k" detail="Current visible crew total" icon={WalletCards} />
        <MetricCard label="Bonus Pool" value="Rp120k" detail="Safety and speed incentives" icon={Calculator} />
        <MetricCard label="Review Needed" value="2" detail="Pending proof before payout" icon={WalletCards} />
      </div>

      <section className="rounded-lg border border-[#F3D7C8] bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Payroll Detail</p>
            <p className="mt-1 text-sm text-[#776B63]">Worker earnings by assignment, status, and fatigue score.</p>
          </div>
          <p className="text-sm font-semibold text-[#FD7124]">Today</p>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-[#F3D7C8]">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_120px_120px_120px] bg-[#FFF8F4] px-4 py-3 text-xs font-semibold uppercase text-[#776B63] md:grid">
            <span>Worker</span>
            <span>Status</span>
            <span>Fatigue</span>
            <span className="text-right">Pay</span>
          </div>

          {workers.map((worker) => (
            <div key={worker.id} className="grid gap-3 border-t border-[#F3D7C8] px-4 py-4 md:grid-cols-[minmax(0,1.4fr)_120px_120px_120px] md:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#2F2C2A]">{worker.name}</p>
                <p className="mt-1 truncate text-sm text-[#776B63]">{worker.task}</p>
              </div>
              <p className="text-sm font-semibold capitalize text-[#5F5A56]">{worker.status}</p>
              <p className="text-sm text-[#776B63]">{worker.fatigue}%</p>
              <p className="text-left text-sm font-semibold text-[#2F2C2A] md:text-right">{worker.pay}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
