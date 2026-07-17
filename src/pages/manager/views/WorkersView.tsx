import { Activity, AlertTriangle, ChevronDown, CloudSun, Droplets, Gauge, Thermometer, TimerReset, UserCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import type { WorkerRestRecommendation } from '../../../hooks/useWorkforceData';
import type { Worker, WorkerEnvironment } from '../../../types/workforce';
import { WorkerBoard } from '../components/WorkerBoard';

type WorkersViewProps = {
  workers: Worker[];
  selectedWorker: Worker;
  onSelectWorker: (worker: Worker) => void;
  getRestRecommendation: (workerId: string) => Promise<WorkerRestRecommendation>;
  onGrantRest: (workerId: string, minutes?: number) => Promise<void>;
};

export function WorkersView({ workers, selectedWorker, onSelectWorker, getRestRecommendation, onGrantRest }: WorkersViewProps) {
  const [recommendation, setRecommendation] = useState<WorkerRestRecommendation | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [grantingRest, setGrantingRest] = useState(false);
  const [environmentOpen, setEnvironmentOpen] = useState(true);
  const [restOpen, setRestOpen] = useState(true);
  const workingCount = workers.filter((worker) => worker.status === 'working').length;
  const breakCount = workers.filter((worker) => worker.status === 'break').length;
  const selectedEnvironment = getWorkerEnvironment(selectedWorker);

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendation() {
      if (!selectedWorker) {
        return;
      }

      setRecommendationLoading(true);
      setRecommendationError(null);

      try {
        const nextRecommendation = await getRestRecommendation(selectedWorker.id);

        if (!cancelled) {
          setRecommendation(nextRecommendation);
        }
      } catch (error) {
        if (!cancelled) {
          setRecommendation(null);
          setRecommendationError(error instanceof Error ? error.message : 'Unable to load rest recommendation');
        }
      } finally {
        if (!cancelled) {
          setRecommendationLoading(false);
        }
      }
    }

    loadRecommendation();

    return () => {
      cancelled = true;
    };
  }, [getRestRecommendation, selectedWorker]);

  useEffect(() => {
    setEnvironmentOpen(true);
    setRestOpen(true);
  }, [selectedWorker.id]);

  const grantRest = async () => {
    if (!selectedWorker || !recommendation) {
      return;
    }

    setGrantingRest(true);
    setRecommendationError(null);

    try {
      await onGrantRest(selectedWorker.id, recommendation.recommendedMinutes);
      setRecommendation(await getRestRecommendation(selectedWorker.id));
    } catch (error) {
      setRecommendationError(error instanceof Error ? error.message : 'Unable to grant rest');
    } finally {
      setGrantingRest(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[#F3D7C8] bg-white p-6 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-[#C95119]">Crew Overview</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-[#2F2C2A]">See availability before choosing a worker.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#776B63]">The page now starts with a simple crew state instead of asking managers to scan every row immediately.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <CrewStat icon={Users} label="On site" value={workers.length} />
            <CrewStat icon={UserCheck} label="Working" value={workingCount} />
            <CrewStat icon={TimerReset} label="Break" value={breakCount} />
          </div>
        </div>
        <div className="mt-5 grid gap-2 border-t border-[#F3D7C8] pt-4 md:grid-cols-3">
          {['Steel Crew', 'Safety Support', 'Inspector'].map((role, index) => (
            <CoverageMini key={role} role={role} value={[3, 2, 1][index]} percent={[78, 54, 32][index]} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#F3D7C8] bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Worker Environment</p>
            <p className="mt-1 text-sm leading-6 text-[#776B63]">
              {selectedWorker.name} / {selectedWorker.environment?.source === 'live' ? 'worker@gmail.com IoT device' : 'stub environment'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex w-fit items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
              selectedEnvironment.source === 'live' ? 'bg-[#E9F8EF] text-[#247A4D]' : 'bg-[#FFF8F4] text-[#776B63]'
            }`}>
              <CloudSun size={14} />
              {selectedEnvironment.source === 'live' ? 'Live IoT' : 'Stub'}
            </span>
            <button
              type="button"
              onClick={() => setEnvironmentOpen((open) => !open)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#F3D7C8] bg-white text-[#776B63] transition hover:border-[#FD7124] hover:bg-[#FFEFE6] hover:text-[#2F2C2A]"
              aria-label={environmentOpen ? 'Minimize worker environment' : 'Expand worker environment'}
              title={environmentOpen ? 'Minimize' : 'Expand'}
            >
              <ChevronDown size={16} className={`transition ${environmentOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {environmentOpen ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <div className="grid gap-3 sm:grid-cols-3">
                <EnvironmentMetric icon={Thermometer} label="Temperature" value={formatEnvironmentValue(selectedEnvironment.temperatureC, 'C')} />
                <EnvironmentMetric icon={Droplets} label="Humidity" value={formatEnvironmentValue(selectedEnvironment.humidityPct, '%')} />
                <EnvironmentMetric icon={Gauge} label="Pressure" value={formatEnvironmentValue(selectedEnvironment.pressureHpa, 'hPa')} />
              </div>

              <p className="mt-4 rounded-2xl bg-[#FFF8F4] px-4 py-3 text-sm leading-6 text-[#776B63]">
                {selectedEnvironment.summary}
              </p>
            </div>

            <div className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#2F2C2A]">Risk Factors</p>
                  <p className="mt-1 text-xs font-semibold text-[#A09188]">{selectedEnvironment.recordedAt ? formatEnvironmentTime(selectedEnvironment.recordedAt) : 'Baseline'}</p>
                </div>
                <span className={`rounded-xl px-3 py-2 text-sm font-semibold ${getEnvironmentRiskStyle(selectedEnvironment.riskLevel)}`}>
                  {selectedEnvironment.riskScore} / {selectedEnvironment.riskLevel}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {selectedEnvironment.riskFactors.map((factor) => (
                  <div key={factor} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm leading-5 text-[#776B63]">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#FD7124]" />
                    <span>{factor}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[#F3D7C8] bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFEFE6] text-[#FD7124]">
              <TimerReset size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#2F2C2A]">Manager Rest Control</p>
              <p className="mt-1 text-sm text-[#776B63]">{selectedWorker.name} / {selectedWorker.zone}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRestOpen((open) => !open)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#F3D7C8] bg-white text-[#776B63] transition hover:border-[#FD7124] hover:bg-[#FFEFE6] hover:text-[#2F2C2A]"
            aria-label={restOpen ? 'Minimize manager rest control' : 'Expand manager rest control'}
            title={restOpen ? 'Minimize' : 'Expand'}
          >
            <ChevronDown size={16} className={`transition ${restOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {restOpen ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
            <div>
              <div className="grid gap-3 sm:grid-cols-3">
                <RestMetric label="Recommended rest" value={recommendationLoading ? '...' : `${recommendation?.recommendedMinutes ?? 0} min`} />
                <RestMetric label="Fatigue level" value={recommendation?.fatigueLevel ?? '-'} />
                <RestMetric label="Chronos" value={recommendation?.chronosStatus ?? 'UNAVAILABLE'} />
              </div>
              <p className="mt-4 rounded-2xl bg-[#FFF8F4] px-4 py-3 text-sm leading-6 text-[#776B63]">
                {recommendation?.reason ?? 'Loading rest recommendation from Fatigue Engine and Chronos context.'}
              </p>
              {recommendationError ? <p className="mt-3 rounded-xl bg-[#FFEFE6] px-3 py-2 text-sm font-semibold text-[#B84011]">{recommendationError}</p> : null}
            </div>

            <div className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-[#FD7124]" />
                <p className="text-sm font-semibold text-[#2F2C2A]">Send worker rest</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#776B63]">Worker app receives a notification and active break timer.</p>
              <Button
                variant="primary"
                className="mt-4 w-full"
                onClick={grantRest}
                disabled={!recommendation || grantingRest || selectedWorker.status === 'break'}
              >
                <TimerReset size={16} />
                {grantingRest ? 'Sending...' : selectedWorker.status === 'break' ? 'Already on break' : 'Give Rest'}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <WorkerBoard workers={workers} selectedWorker={selectedWorker} onSelectWorker={onSelectWorker} />
    </div>
  );
}

function RestMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
      <p className="text-[11px] font-semibold uppercase text-[#A09188]">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold text-[#2F2C2A]">{value}</p>
    </div>
  );
}

function EnvironmentMetric({ icon: Icon, label, value }: { icon: typeof Thermometer; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase text-[#A09188]">{label}</p>
        <Icon size={17} className="text-[#FD7124]" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#2F2C2A]">{value}</p>
    </div>
  );
}

function getWorkerEnvironment(worker: Worker): WorkerEnvironment {
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
    riskFactors: ['No assigned IoT device yet', `${worker.workload} workload baseline`, `${worker.fatigue}% fatigue baseline`],
    summary: 'Stub environment until this worker receives a dedicated IoT device.'
  };
}

function formatEnvironmentValue(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) {
    return '-';
  }

  return `${unit === '%' ? Math.round(value) : value.toFixed(1)}${unit === 'hPa' ? ' hPa' : unit}`;
}

function formatEnvironmentTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function getEnvironmentRiskStyle(level: WorkerEnvironment['riskLevel']) {
  if (level === 'CRITICAL') return 'bg-[#FFEFE6] text-[#B84011]';
  if (level === 'HIGH') return 'bg-[#FFF4DC] text-[#8A4B02]';
  if (level === 'MEDIUM') return 'bg-[#FFEFE6] text-[#C95119]';
  return 'bg-[#E9F8EF] text-[#247A4D]';
}

function CrewStat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#FFF8F4] p-4 text-center">
      <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white text-[#FD7124]">
        <Icon size={17} />
      </span>
      <p className="mt-3 text-3xl font-semibold text-[#2F2C2A]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#776B63]">{label}</p>
    </div>
  );
}

function CoverageMini({ role, value, percent }: { role: string; value: number; percent: number }) {
  return (
    <div className="rounded-xl bg-[#FFF8F4] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-xs font-semibold text-[#776B63]">{role}</p>
        <p className="shrink-0 text-sm font-semibold text-[#2F2C2A]">{value} available</p>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white">
        <div className="h-1.5 rounded-full bg-[#FD7124]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
