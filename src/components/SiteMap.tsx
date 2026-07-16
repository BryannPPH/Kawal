import { AlertTriangle, RadioTower } from 'lucide-react';
import type { RiskLevel, RiskScore, SiteZone, ZoneId } from '../types/site';

type SiteMapProps = {
  zones: SiteZone[];
  risks: RiskScore[];
  selectedZoneId: ZoneId;
  onSelectZone: (zoneId: ZoneId) => void;
};

const levelStyles: Record<RiskLevel, string> = {
  low: 'border-emerald-400 bg-emerald-50 text-emerald-800',
  medium: 'border-[#FAA745] bg-[#FFEFE6] text-[#8a4b02]',
  high: 'border-[#FD7124] bg-[#FFEFE6] text-[#9f3308]',
  critical: 'border-rose-500 bg-rose-50 text-rose-900'
};

export function SiteMap({ zones, risks, selectedZoneId, onSelectZone }: SiteMapProps) {
  const riskByZone = new Map(risks.map((risk) => [risk.zoneId, risk]));

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-white bg-white shadow-panel">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect x="2" y="4" width="96" height="90" rx="2" fill="#F1F2F7" stroke="#d8dbe6" />
        <path d="M4 50H96" stroke="#c7cbd8" strokeWidth="0.5" strokeDasharray="2 2" />
        <path d="M39 6V92" stroke="#c7cbd8" strokeWidth="0.5" strokeDasharray="2 2" />
        <path d="M6 90H94" stroke="#FD7124" strokeWidth="1.5" />
        <path d="M7 78C20 69 29 70 41 75C53 80 66 78 91 62" fill="none" stroke="#FAA745" strokeWidth="1" strokeDasharray="3 2" />
      </svg>

      <div className="absolute left-4 top-4 z-10 rounded-md border border-white bg-white/90 px-3 py-2 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Facility map</p>
        <p className="text-sm font-bold text-slate-950">Sensor risk by zone</p>
      </div>

      {zones.map((zone) => {
        const risk = riskByZone.get(zone.id);
        const selected = selectedZoneId === zone.id;

        return (
          <button
            key={zone.id}
            type="button"
            onClick={() => onSelectZone(zone.id)}
            className={`absolute flex flex-col justify-between rounded-md border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#FD7124] ${
              levelStyles[risk?.level ?? 'low']
            } ${selected ? 'ring-2 ring-[#FD7124]' : ''}`}
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
            <span className="flex items-end justify-between gap-2">
              <span className="text-2xl font-bold leading-none">{risk?.score ?? 0}</span>
              <span className="text-[10px] font-bold uppercase">{risk?.level ?? 'low'}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
