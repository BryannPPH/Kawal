import { History } from 'lucide-react';
import type { ActivityLogEntry } from '../types/site';

type ActivityLogProps = {
  activity: ActivityLogEntry[];
};

const kindStyles = {
  telemetry: 'bg-sky-100 text-sky-800',
  risk: 'bg-rose-100 text-rose-900',
  intervention: 'bg-indigo-100 text-indigo-900',
  inspection: 'bg-emerald-100 text-emerald-900'
};

export function ActivityLog({ activity }: ActivityLogProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div className="mb-3 flex items-center gap-2">
        <History size={18} className="text-slate-700" />
        <h2 className="text-sm font-semibold text-slate-900">Activity Logger</h2>
      </div>
      <div className="space-y-3">
        {activity.map((item) => (
          <div key={item.id} className="flex gap-3 rounded-md border border-slate-200 p-3">
            <span className={`h-fit rounded px-2 py-1 text-xs font-semibold ${kindStyles[item.kind]}`}>{item.kind}</span>
            <div>
              <p className="text-sm text-slate-700">{item.message}</p>
              <p className="mt-1 text-xs text-slate-400">{new Date(item.at).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
