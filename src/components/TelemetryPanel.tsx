import { Gauge, RotateCcw, Shuffle } from 'lucide-react';
import type { TelemetryReading } from '../types/site';

type TelemetryPanelProps = {
  reading: TelemetryReading;
  onSimulate: () => void;
  onReset: () => void;
};

const metrics = [
  ['temperature', 'Temp', 'C'],
  ['vibration', 'Vibration', 'mm/s'],
  ['humidity', 'Humidity', '%'],
  ['occupancy', 'Occupancy', 'people'],
  ['smokePpm', 'Smoke', 'ppm']
] as const;

export function TelemetryPanel({ reading, onSimulate, onReset }: TelemetryPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge size={18} className="text-sky-700" />
          <h2 className="text-sm font-semibold text-slate-900">Telemetry Adapter</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Simulate telemetry"
            title="Simulate telemetry"
            onClick={onSimulate}
            className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Shuffle size={17} />
          </button>
          <button
            type="button"
            aria-label="Reset state"
            title="Reset state"
            onClick={onReset}
            className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map(([key, label, unit]) => (
          <div key={key} className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-950">{reading[key]}</span>
              <span className="text-xs text-slate-500">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">Last update {new Date(reading.updatedAt).toLocaleTimeString()}</p>
    </section>
  );
}
