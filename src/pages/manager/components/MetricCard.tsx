import type { LucideIcon } from 'lucide-react';

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

export function MetricCard({ label, value, detail, icon: Icon }: MetricCardProps) {
  return (
    <section className="rounded-lg border border-[#F3D7C8] bg-white p-5 shadow-[0_10px_28px_rgba(76,48,35,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#776B63]">{label}</p>
        <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFEFE6] text-[#FD7124]">
          <Icon size={17} />
        </span>
      </div>
      <p className="mt-6 text-3xl font-semibold tracking-normal text-[#2F2C2A]">{value}</p>
      <p className="mt-2 text-sm leading-5 text-[#776B63]">{detail}</p>
    </section>
  );
}
