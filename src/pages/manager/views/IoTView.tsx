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
  const signalCount = overview.activeIncidents.length + overview.restRequests.length;
  const connectionPct = overview.devices.length ? Math.round((onlineDevices / overview.devices.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-lg border border-[#F3D7C8] bg-white">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6 sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#C95119]">IoT Safety Panel</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-normal text-[#2F2C2A]">Worker signals stay simple: rest or SOS.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#776B63]">Each card represents one designated wearable. Incident handling stays in the Incident Center.</p>
              </div>
              <Button onClick={loadOverview}>
                <RefreshCw size={15} />
                Refresh
              </Button>
            </div>
            {error ? <p className="mt-5 rounded-md bg-[#FFF4DC] px-3 py-2 text-sm font-semibold text-[#8A4B02]">API unavailable: {error}</p> : null}
          </div>

          <div className="border-t border-[#F3D7C8] bg-[#FFF8F4] p-6 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-4">
              <SignalBubble label="SOS" value={overview.activeIncidents.length} tone="danger" />
              <SignalBubble label="Rest" value={overview.restRequests.length} tone="warning" />
              <SignalBubble label="Quiet" value={Math.max(overview.devices.length - signalCount, 0)} tone="neutral" />
            </div>
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-[#2F2C2A]">Wearables connected</span>
                <span className="text-[#776B63]">{connectionPct}%</span>
              </div>
              <div className="h-3 rounded-full bg-white">
                <div className="h-3 rounded-full bg-[#55936A]" style={{ width: `${connectionPct}%` }} />
              </div>
            </div>
          </div>
        </div>
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

      <section className="rounded-lg border border-[#F3D7C8] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Worker IoT Signals</p>
            <p className="mt-1 text-sm text-[#776B63]">Only rest requests and SOS signals from each person&apos;s assigned IoT device.</p>
          </div>
          <span className="rounded-md bg-[#FFEFE6] px-3 py-1 text-xs font-semibold text-[#C95119]">5s polling</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {overview.devices.length ? (
            overview.devices.map((device) => <WorkerSignalCard key={device.id} device={device} overview={overview} />)
          ) : (
            <EmptyState text="No assigned IoT device records yet." />
          )}
        </div>
      </section>
    </div>
  );
}

function SignalBubble({ label, value, tone }: { label: string; value: number; tone: 'danger' | 'warning' | 'neutral' }) {
  const style = {
    danger: 'bg-[#FFEFE6] text-[#B84011]',
    warning: 'bg-[#FFF4DC] text-[#8A4B02]',
    neutral: 'bg-white text-[#5F5A56]'
  }[tone];

  return (
    <div className={`grid h-24 flex-1 place-items-center rounded-lg ${style}`}>
      <div className="text-center">
        <p className="text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-xs font-semibold">{label}</p>
      </div>
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
    <div className="rounded-lg border border-[#F3D7C8] bg-white p-5">
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
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className={`rounded-md px-4 py-4 ${sos ? 'bg-[#FFEFE6]' : 'bg-[#FFF8F4]'}`}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className={sos ? 'text-[#B84011]' : 'text-[#A09188]'} />
            <p className="text-xs font-semibold text-[#2F2C2A]">SOS Signal</p>
          </div>
          <p className="mt-2 text-sm text-[#776B63]">{sos ? `${sos.state} at ${formatTime(sos.opened_at)}` : 'No SOS signal'}</p>
        </div>
        <div className={`rounded-md px-4 py-4 ${rest ? 'bg-[#FFF4DC]' : 'bg-[#FFF8F4]'}`}>
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
