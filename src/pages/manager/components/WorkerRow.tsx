import { CloudSun } from 'lucide-react';
import { Pill } from '../../../components/ui/Pill';
import { statusLabels, statusStyles } from '../../../constants/workforce';
import type { Worker, WorkerEnvironment } from '../../../types/workforce';
import { WorkHoursScale } from './WorkHoursScale';

type WorkerRowProps = {
  worker: Worker;
  selected: boolean;
  onSelect: (worker: Worker) => void;
  onOpenDetails?: (worker: Worker) => void;
  compact?: boolean;
};

export function WorkerRow({ worker, selected, onSelect, onOpenDetails, compact = false }: WorkerRowProps) {
  const environment = getRowEnvironment(worker);

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(worker)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(worker);
          }
        }}
        className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-white px-3 py-3 text-left transition hover:border-[#FAA745] hover:bg-[#FFF8F4] ${
          selected ? 'border-[#FD7124] ring-2 ring-[#FFEFE6]' : 'border-[#F3D7C8]'
        }`}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFEFE6] text-xs font-semibold text-[#C95119]">
              {worker.name
                .split(' ')
                .map((word) => word[0])
                .join('')
                .slice(0, 2)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[#2F2C2A]">{worker.name}</span>
              <span className="mt-0.5 block truncate text-xs text-[#776B63]">{worker.zone} / {worker.task}</span>
            </span>
          </span>
          <span className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
            <span>
              <span className="flex justify-between text-[11px] font-medium text-[#A09188]">
                <span>Fatigue</span>
                <span>{worker.fatigue}%</span>
              </span>
              <span className="mt-1.5 block h-1.5 rounded-full bg-[#F5D8C8]">
                <span
                  className={`block h-1.5 rounded-full ${worker.fatigue >= 55 ? 'bg-[#FAA745]' : 'bg-[#FD7124]'}`}
                  style={{ width: `${worker.fatigue}%` }}
                />
              </span>
            </span>
            <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${getEnvironmentBadgeStyle(environment.riskLevel)}`}>{environment.riskLevel}</span>
          </span>
        </span>

        <span className="flex flex-col items-end gap-2">
          <Pill className={statusStyles[worker.status]}>{statusLabels[worker.status]}</Pill>
          <span className="text-xs font-semibold text-[#C95119]">{formatCompactValue(environment.temperatureC, 'C')} / {formatCompactValue(environment.humidityPct, '%')}</span>
        </span>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(worker)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(worker);
        }
      }}
      className={`grid w-full cursor-pointer grid-cols-1 items-center gap-4 rounded-2xl border bg-white p-5 text-left transition hover:border-[#FAA745] hover:bg-[#FFF8F4] lg:grid-cols-3 xl:grid-cols-[minmax(220px,1.2fr)_130px_180px_minmax(130px,0.72fr)_90px] ${
        selected ? 'border-[#FD7124] ring-2 ring-[#FFEFE6]' : 'border-[#F3D7C8]'
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFEFE6] text-sm font-semibold text-[#C95119]">
          {worker.name
            .split(' ')
            .map((word) => word[0])
            .join('')
            .slice(0, 2)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[#2F2C2A]">{worker.name}</span>
          <span className="mt-1 block truncate text-sm text-[#776B63]">{worker.role} / {worker.task}</span>
        </span>
      </span>

      <span className="flex items-center justify-center">
        <span className="flex min-w-0 flex-col items-center self-center text-center">
        <span className="block text-xs font-medium text-[#A09188]">Status</span>
        <Pill className={statusStyles[worker.status]}>{statusLabels[worker.status]}</Pill>
        </span>
      </span>

      <WorkHoursScale minutes={worker.yesterdayWorkedMinutes} compact />

      <span>
        <span className="flex justify-between text-xs font-medium text-[#A09188]">
          <span>Fatigue</span>
          <span>{worker.fatigue}%</span>
        </span>
        <span className="mt-2 block h-1.5 rounded-full bg-[#F5D8C8]">
          <span
            className={`block h-1.5 rounded-full ${worker.fatigue >= 55 ? 'bg-[#FAA745]' : 'bg-[#FD7124]'}`}
            style={{ width: `${worker.fatigue}%` }}
          />
        </span>
        <span className="mt-2 block text-xs text-[#776B63]">{worker.zone} / {worker.time}</span>
      </span>

      <span className="text-left lg:text-right">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (onOpenDetails) {
              onOpenDetails(worker);
              return;
            }

            onSelect(worker);
          }}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-[#F3D7C8] bg-white px-3 text-sm font-semibold text-[#C95119] transition hover:border-[#FD7124] hover:bg-[#FFEFE6] lg:w-auto"
        >
          Details
        </button>
      </span>
    </div>
  );
}

function getRowEnvironment(worker: Worker): WorkerEnvironment {
  if (worker.environment) {
    return worker.environment;
  }

  const riskScore = Math.max(18, Math.min(62, worker.fatigue + (worker.workload === 'High' ? 12 : worker.workload === 'Medium' ? 8 : 4)));

  return {
    source: 'stub',
    temperatureC: 24,
    humidityPct: 60,
    pressureHpa: 1010,
    riskScore,
    riskLevel: riskScore >= 65 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW',
    riskFactors: [],
    summary: 'Stub environment'
  };
}

function formatCompactValue(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) {
    return '-';
  }

  if (unit === 'hPa') {
    return `${Math.round(value)}`;
  }

  return `${unit === '%' ? Math.round(value) : Math.round(value)}${unit}`;
}

function getEnvironmentBadgeStyle(level: WorkerEnvironment['riskLevel']) {
  if (level === 'CRITICAL') return 'bg-[#FFEFE6] text-[#B84011]';
  if (level === 'HIGH') return 'bg-[#FFF4DC] text-[#8A4B02]';
  if (level === 'MEDIUM') return 'bg-[#FFEFE6] text-[#C95119]';
  return 'bg-[#E9F8EF] text-[#247A4D]';
}
