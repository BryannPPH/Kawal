import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ProcedureStepProps = {
  done: boolean;
  icon: LucideIcon;
  label: string;
};

export function ProcedureStep({ done, icon: Icon, label }: ProcedureStepProps) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-[#F3D7C8] bg-white p-3">
      <span className={`grid h-8 w-8 place-items-center rounded-xl ${done ? 'bg-[#FFEFE6] text-[#FD7124]' : 'bg-[#F1F2F7] text-[#776B63]'}`}>
        {done ? <Check size={16} /> : <Icon size={16} />}
      </span>
      <span className="text-sm font-semibold text-[#3D3835]">{label}</span>
    </li>
  );
}
