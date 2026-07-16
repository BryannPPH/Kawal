import { ActivityLog } from './components/ActivityLog';
import { EnginePanels } from './components/EnginePanels';
import { SiteMap } from './components/SiteMap';
import { TelemetryPanel } from './components/TelemetryPanel';
import { useSiteStore } from './store/siteStore';

function App() {
  const {
    zones,
    telemetry,
    risks,
    interventions,
    inspections,
    activity,
    selectedZoneId,
    setSelectedZone,
    simulateTelemetryBurst,
    resetSite
  } = useSiteStore();

  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? zones[0];
  const selectedTelemetry = telemetry.find((reading) => reading.zoneId === selectedZone.id) ?? telemetry[0];
  const siteRisk = Math.round(risks.reduce((total, risk) => total + risk.score, 0) / risks.length);

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-sky-700">Garuda Site Ops</p>
            <h1 className="mt-1 text-3xl font-bold tracking-normal text-slate-950">IoT Risk Command Dashboard</h1>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-medium text-slate-500">Site Risk</div>
              <div className="mt-1 text-2xl font-bold">{siteRisk}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-medium text-slate-500">Zones</div>
              <div className="mt-1 text-2xl font-bold">{zones.length}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-medium text-slate-500">Tasks</div>
              <div className="mt-1 text-2xl font-bold">{inspections.length}</div>
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <SiteMap zones={zones} risks={risks} selectedZoneId={selectedZoneId} onSelectZone={setSelectedZone} />
            <EnginePanels zones={zones} risks={risks} interventions={interventions} inspections={inspections} />
          </div>
          <aside className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
              <div className="text-xs font-medium uppercase tracking-normal text-slate-500">Selected Zone</div>
              <h2 className="mt-1 text-xl font-bold text-slate-950">{selectedZone.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{selectedZone.asset}</p>
            </div>
            <TelemetryPanel reading={selectedTelemetry} onSimulate={simulateTelemetryBurst} onReset={resetSite} />
            <ActivityLog activity={activity} />
          </aside>
        </section>
      </div>
    </main>
  );
}

export default App;
