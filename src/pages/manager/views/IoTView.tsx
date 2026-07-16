import { AlertTriangle, CheckCircle2, Radio, RefreshCw, ShieldAlert, TimerReset, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import type { IoTDevice, IoTOverview } from '../../../types/iot';

const fallbackOverview: IoTOverview = {
  devices: [],
  activeIncidents: [],
  restRequests: [],
  commands: [],
  latestFatigue: [],
  latestRisk: []
};

export function IoTView() {
  const [overview, setOverview] = useState<IoTOverview>(fallbackOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    try {
      const response = await fetch('/api/iot/overview');

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      setOverview((await response.json()) as IoTOverview);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load IoT overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
    const timer = window.setInterval(loadOverview, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const onlineDevices = overview.devices.filter((device) => device.status === 'ONLINE').length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#F3D7C8] bg-white/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">IoT Safety Panel</p>
            <p className="mt-1 text-sm text-[#776B63]">Each worker&apos;s designated wearable and its current rest or SOS signal.</p>
          </div>
          <Button onClick={loadOverview}>
            <RefreshCw size={15} />
            Refresh
          </Button>
        </div>
        {error ? <p className="mt-3 rounded-md bg-[#FFF4DC] px-3 py-2 text-sm font-semibold text-[#8A4B02]">API unavailable: {error}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusTile
          icon={Radio}
          label="IoT Connected"
          value={`${onlineDevices}/${overview.devices.length || 1}`}
          detail={loading ? 'Loading device state' : 'Online wearables'}
          tone="success"
        />
        <StatusTile
          icon={ShieldAlert}
          label="SOS Signal"
          value={String(overview.activeIncidents.length)}
          detail="Wearable emergency requests"
          tone={overview.activeIncidents.length ? 'danger' : 'neutral'}
        />
        <StatusTile
          icon={TimerReset}
          label="Rest Request"
          value={String(overview.restRequests.length)}
          detail="Wearable break requests"
          tone={overview.restRequests.length ? 'warning' : 'neutral'}
        />
        <StatusTile icon={AlertTriangle} label="Offline IoT" value={String(overview.devices.length - onlineDevices)} detail="Assigned devices needing check" tone={onlineDevices === overview.devices.length ? 'success' : 'warning'} />
      </section>

      <section className="rounded-lg border border-[#F3D7C8] bg-white/70 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Worker IoT Signals</p>
            <p className="mt-1 text-sm text-[#776B63]">Only rest requests and SOS signals from each person&apos;s assigned IoT device.</p>
          </div>
          <span className="rounded-md bg-[#FFEFE6] px-3 py-1 text-xs font-semibold text-[#C95119]">5s polling</span>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {overview.devices.length ? (
            overview.devices.map((device) => <WorkerSignalCard key={device.id} device={device} overview={overview} />)
          ) : (
            <EmptyState text="No assigned IoT device records yet. Run bun run db:seed." />
          )}
        </div>
      </section>
    </div>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  detail,
  tone
}: {
  icon: typeof Radio;
  label: string;
  value: string;
  detail: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    neutral: 'bg-[#F1F2F7] text-[#5F5A56]',
    success: 'bg-[#FFF7ED] text-[#9A5719]',
    warning: 'bg-[#FFF4DC] text-[#8A4B02]',
    danger: 'bg-[#FFEFE6] text-[#B84011]'
  }[tone];

  return (
    <div className="rounded-lg border border-[#F3D7C8] bg-white/75 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-lg ${toneClass}`}>
          <Icon size={18} />
        </span>
        {tone === 'success' ? <CheckCircle2 size={17} className="text-[#9A5719]" /> : tone === 'danger' ? <AlertTriangle size={17} className="text-[#B84011]" /> : null}
      </div>
      <p className="mt-5 text-2xl font-semibold text-[#2F2C2A]">{value}</p>
      <p className="mt-1 text-sm font-semibold text-[#2F2C2A]">{label}</p>
      <p className="mt-1 text-sm text-[#776B63]">{detail}</p>
    </div>
  );
}

function WorkerSignalCard({ device, overview }: { device: IoTDevice; overview: IoTOverview }) {
  const sos = overview.activeIncidents.find((incident) => incident.device_id === device.id);
  const rest = overview.restRequests.find((request) => request.device_id === device.id);
  const restScore = rest?.fatigue_score_at_request ?? rest?.risk_score_at_request;
  const hasSignal = Boolean(sos || rest);

  return (
    <div className="rounded-lg border border-[#F3D7C8] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-lg ${device.status === 'ONLINE' ? 'bg-[#FFEFE6] text-[#FD7124]' : 'bg-[#F1F2F7] text-[#776B63]'}`}>
            {device.status === 'ONLINE' ? <Radio size={18} /> : <WifiOff size={18} />}
          </span>
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">{device.assignedWorkerId ?? 'Unassigned worker'}</p>
            <p className="mt-1 text-xs text-[#776B63]">{device.name} / {device.assignedZoneId ?? 'No zone'}</p>
          </div>
        </div>
        <span className={`rounded px-2 py-1 text-[11px] font-semibold ${hasSignal ? 'bg-[#FFEFE6] text-[#B84011]' : 'bg-[#F1F2F7] text-[#5F5A56]'}`}>
          {hasSignal ? 'Signal active' : 'No request'}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className={`rounded-md px-3 py-3 ${sos ? 'bg-[#FFEFE6]' : 'bg-[#FFF8F4]'}`}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className={sos ? 'text-[#B84011]' : 'text-[#A09188]'} />
            <p className="text-xs font-semibold text-[#2F2C2A]">SOS Signal</p>
          </div>
          <p className="mt-2 text-sm text-[#776B63]">{sos ? `${sos.state} at ${formatTime(sos.opened_at)}` : 'No SOS signal'}</p>
        </div>
        <div className={`rounded-md px-3 py-3 ${rest ? 'bg-[#FFF4DC]' : 'bg-[#FFF8F4]'}`}>
          <div className="flex items-center gap-2">
            <TimerReset size={15} className={rest ? 'text-[#8A4B02]' : 'text-[#A09188]'} />
            <p className="text-xs font-semibold text-[#2F2C2A]">Rest Request</p>
          </div>
          <p className="mt-2 text-sm text-[#776B63]">{rest ? `${rest.status} / fatigue ${restScore}` : 'No rest request'}</p>
        </div>
      </div>
      {sos || rest ? (
        <div className="mt-3 rounded-md border border-[#F3D7C8] bg-[#FFF8F4] px-3 py-2">
          {sos ? <p className="text-xs font-semibold text-[#B84011]">Incident Center handles acknowledgement, escalation, and resolution.</p> : null}
          {rest ? <p className="text-xs font-semibold text-[#8A4B02]">Incident Center handles rest request review.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-md bg-[#FFF8F4] px-3 py-3 text-sm text-[#776B63]">{text}</p>;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
