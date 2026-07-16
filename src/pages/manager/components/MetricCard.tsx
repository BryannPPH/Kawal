import type { LucideIcon } from 'lucide-react';

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

export function MetricCard({ label, value, detail, icon: Icon }: MetricCardProps) {
  return (
    <section className="rounded-lg border border-[#F3D7C8] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#776B63]">{label}</p>
        <span className="grid h-9 w-9 place-items-center rounded-md bg-[#FFEFE6] text-[#FD7124]">
          <Icon size={17} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-normal text-[#2F2C2A]">{value}</p>
      <p className="mt-1 text-sm text-[#776B63]">{detail}</p>
    </section>
  );
}
