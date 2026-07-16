import { ClipboardCheck, Route, ShieldAlert } from 'lucide-react';
import type { InspectionTask, Intervention, RiskScore, SiteZone } from '../types/site';

type EnginePanelsProps = {
  zones: SiteZone[];
  risks: RiskScore[];
  interventions: Intervention[];
  inspections: InspectionTask[];
};

const badgeStyles = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-900',
  high: 'bg-orange-100 text-orange-900',
  critical: 'bg-rose-100 text-rose-900'
};

export function EnginePanels({ zones, risks, interventions, inspections }: EnginePanelsProps) {
  const zoneName = new Map(zones.map((zone) => [zone.id, zone.name]));

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert size={18} className="text-rose-700" />
          <h2 className="text-sm font-semibold text-slate-900">Risk Engine</h2>
        </div>
        <div className="space-y-3">
          {risks.slice(0, 4).map((risk) => (
            <div key={risk.zoneId} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{zoneName.get(risk.zoneId)}</span>
                <span className={`rounded px-2 py-1 text-xs font-semibold ${badgeStyles[risk.level]}`}>{risk.level}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-sky-600" style={{ width: `${risk.score}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{risk.drivers[0]}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <div className="mb-3 flex items-center gap-2">
          <Route size={18} className="text-sky-700" />
          <h2 className="text-sm font-semibold text-slate-900">Intervention Optimizer</h2>
        </div>
        <div className="space-y-3">
          {interventions.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                <span className="whitespace-nowrap text-xs font-medium text-slate-500">{item.etaMinutes} min</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{item.impact}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardCheck size={18} className="text-emerald-700" />
          <h2 className="text-sm font-semibold text-slate-900">Inspection Engine</h2>
        </div>
        <div className="space-y-3">
          {inspections.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">No active inspection tasks.</p>
          ) : (
            inspections.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded px-2 py-1 text-xs font-semibold ${badgeStyles[item.severity]}`}>{item.severity}</span>
                  <span className="text-xs font-medium text-slate-500">Due {item.dueInMinutes} min</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.checklist}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
