import { AlertTriangle, RadioTower } from 'lucide-react';
import type { RiskLevel, RiskScore, SiteZone, ZoneId } from '../types/site';

type SiteMapProps = {
  zones: SiteZone[];
  risks: RiskScore[];
  selectedZoneId: ZoneId;
  onSelectZone: (zoneId: ZoneId) => void;
};

const levelStyles: Record<RiskLevel, string> = {
  low: 'border-emerald-500 bg-emerald-50 text-emerald-800',
  medium: 'border-amber-500 bg-amber-50 text-amber-800',
  high: 'border-orange-500 bg-orange-50 text-orange-900',
  critical: 'border-rose-600 bg-rose-50 text-rose-900'
};

export function SiteMap({ zones, risks, selectedZoneId, onSelectZone }: SiteMapProps) {
  const riskByZone = new Map(risks.map((risk) => [risk.zoneId, risk]));

  return (
    <div className="relative min-h-[380px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-panel">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect x="2" y="4" width="96" height="90" rx="2" fill="#f8fafc" stroke="#cbd5e1" />
        <path d="M4 50H96" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2 2" />
        <path d="M39 6V92" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2 2" />
        <path d="M6 90H94" stroke="#94a3b8" strokeWidth="1.5" />
      </svg>

      {zones.map((zone) => {
        const risk = riskByZone.get(zone.id);
        const selected = selectedZoneId === zone.id;

        return (
          <button
            key={zone.id}
            type="button"
            onClick={() => onSelectZone(zone.id)}
            className={`absolute flex flex-col justify-between rounded-md border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 ${
              levelStyles[risk?.level ?? 'low']
            } ${selected ? 'ring-2 ring-sky-600' : ''}`}
            style={{
              left: `${zone.x}%`,
              top: `${zone.y}%`,
              width: `${zone.width}%`,
              height: `${zone.height}%`
            }}
          >
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal">
              {risk?.level === 'critical' ? <AlertTriangle size={15} /> : <RadioTower size={15} />}
              {zone.name}
            </span>
            <span className="text-2xl font-bold leading-none">{risk?.score ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
