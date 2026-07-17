const regularShiftMinutes = 8 * 60;
const scaleMaximumMinutes = 12 * 60;

type WorkHoursScaleProps = {
  minutes: number;
  compact?: boolean;
};

export function WorkHoursScale({ minutes, compact = false }: WorkHoursScaleProps) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const noWorkLogged = safeMinutes === 0;
  const overtimeMinutes = Math.max(0, safeMinutes - regularShiftMinutes);
  const overtime = overtimeMinutes > 0;
  const progress = Math.min(100, (safeMinutes / scaleMaximumMinutes) * 100);

  return (
    <span className={`block min-w-0 text-left ${compact ? '' : 'rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4'}`}>
      <span className="flex items-start justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase text-[#A09188]">Yesterday</span>
          <span className={`mt-1 block font-semibold text-[#2F2C2A] ${compact ? 'text-sm' : 'text-lg'}`}>
            {formatWorkedMinutes(safeMinutes)}
          </span>
        </span>
        <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${
          noWorkLogged
            ? 'bg-[#F1F2F7] text-[#776B63]'
            : overtime
              ? 'bg-[#FFEFE6] text-[#B84011]'
              : 'bg-[#E9F8EF] text-[#247A4D]'
        }`}>
          {noWorkLogged ? 'No work logged' : overtime ? `Overtime +${formatWorkedMinutes(overtimeMinutes)}` : 'No overtime'}
        </span>
      </span>

      <span className="relative mt-3 block h-2 rounded-full bg-[#E8D8CF]">
        <span
          className={`block h-2 rounded-full ${overtime ? 'bg-[#FD7124]' : 'bg-[#FAA745]'}`}
          style={{ width: `${progress}%` }}
        />
        <span className="absolute bottom-[-3px] top-[-3px] w-px bg-[#776B63]" style={{ left: '66.67%' }} />
      </span>
      <span className="mt-1.5 grid grid-cols-3 text-[9px] font-semibold text-[#A09188]">
        <span>0h</span>
        <span className="text-center">8h shift</span>
        <span className="text-right">12h</span>
      </span>
    </span>
  );
}

export function formatWorkedMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (!hours) return minutes ? `${minutes}m` : '0h';
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}
