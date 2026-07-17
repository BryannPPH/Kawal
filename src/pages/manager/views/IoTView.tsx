import { AlertTriangle, CheckCircle2, ClipboardCheck, Radio, RefreshCw, ShieldAlert, TimerReset, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Pill } from '../../../components/ui/Pill';
import type { IncidentCenterData, IoTDevice, IoTIncident, IoTOverview, RestRequest } from '../../../types/iot';

const fallbackOverview: IoTOverview = {
  devices: [],
  activeIncidents: [],
  restRequests: [],
  commands: [],
  latestFatigue: [],
  latestRisk: []
};

const fallbackCenter: IncidentCenterData = {
  activeIncidents: [],
  incidentHistory: [],
  nearMissReports: []
};

export function IoTView() {
  const [overview, setOverview] = useState<IoTOverview>(fallbackOverview);
  const [center, setCenter] = useState<IncidentCenterData>(fallbackCenter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadOverview = async () => {
    try {
      const [overviewResponse, centerResponse] = await Promise.all([
        fetch('/api/iot/overview'),
        fetch('/api/incidents/center')
      ]);

      if (!overviewResponse.ok || !centerResponse.ok) {
        throw new Error(`API returned ${overviewResponse.status}/${centerResponse.status}`);
      }

      setOverview((await overviewResponse.json()) as IoTOverview);
      setCenter((await centerResponse.json()) as IncidentCenterData);
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

  const activeIncidents = center.activeIncidents.length ? center.activeIncidents : overview.activeIncidents;
  const onlineDevices = overview.devices.filter((device) => device.status === 'ONLINE').length;
  const signalCount = activeIncidents.length + overview.restRequests.length;
  const connectionPct = overview.devices.length ? Math.round((onlineDevices / overview.devices.length) * 100) : 0;

  const updateIncident = async (incidentId: string, action: 'acknowledge' | 'escalate' | 'resolve') => {
    setActionError(null);
    setActingId(`${incidentId}-${action}`);

    try {
      const response = await fetch(`/api/incidents/${incidentId}/${action}`, { method: 'POST' });

      if (!response.ok) {
        throw new Error(`Incident action failed (${response.status})`);
      }

      await loadOverview();
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Unable to update incident');
    } finally {
      setActingId(null);
    }
  };

  const updateRestRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setActionError(null);
    setActingId(`${requestId}-${action}`);

    try {
      const response = await fetch(`/api/rest-requests/${requestId}/${action}`, {
        method: 'POST',
        headers: action === 'reject' ? { 'Content-Type': 'application/json' } : undefined,
        body: action === 'reject' ? JSON.stringify({ reason: 'Manager rejected rest request from IoT panel.' }) : undefined
      });

      if (!response.ok) {
        throw new Error(`Rest request action failed (${response.status})`);
      }

      await loadOverview();
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Unable to update rest request');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-[#F3D7C8] bg-white">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6 sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#C95119]">IoT Safety Panel</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-normal text-[#2F2C2A]">Worker signals stay simple: rest or SOS.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#776B63]">Review rest requests and SOS alerts from each worker&apos;s designated wearable in one queue.</p>
              </div>
              <Button onClick={loadOverview}>
                <RefreshCw size={15} />
                Refresh
              </Button>
            </div>
            {error ? <p className="mt-5 rounded-xl bg-[#FFF4DC] px-3 py-2 text-sm font-semibold text-[#8A4B02]">API unavailable: {error}</p> : null}
          </div>

          <div className="border-t border-[#F3D7C8] bg-[#FFF8F4] p-6 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-4">
              <SignalBubble label="SOS" value={activeIncidents.length} tone="danger" />
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
          value={String(activeIncidents.length)}
          detail="Wearable emergency requests"
          tone={activeIncidents.length ? 'danger' : 'neutral'}
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

      <section className="rounded-2xl border border-[#F3D7C8] bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Signal Queue</p>
            <p className="mt-1 text-sm text-[#776B63]">SOS alerts and rest requests are handled together from worker IoT devices.</p>
          </div>
          <span className="rounded-xl bg-[#FFF8F4] px-3 py-1 text-xs font-semibold text-[#776B63]">{signalCount} active signals</span>
        </div>

        {actionError ? <p className="mb-4 rounded-xl bg-[#FFEFE6] px-3 py-2 text-sm font-semibold text-[#B84011]">{actionError}</p> : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl bg-[#FFF8F4] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#2F2C2A]">SOS Signals</p>
              <Pill className={activeIncidents.length ? 'bg-[#FFEFE6] text-[#B84011]' : 'bg-white text-[#776B63]'}>{activeIncidents.length} active</Pill>
            </div>
            <div className="space-y-3">
              {activeIncidents.length ? (
                activeIncidents.map((incident) => (
                  <IncidentSignalCard
                    key={incident.id}
                    incident={incident}
                    actingId={actingId}
                    onUpdateIncident={updateIncident}
                  />
                ))
              ) : (
                <EmptyState text="No active SOS signals." />
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-[#FFF8F4] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#2F2C2A]">Rest Requests</p>
              <Pill className={overview.restRequests.length ? 'bg-[#FFF4DC] text-[#8A4B02]' : 'bg-white text-[#776B63]'}>{overview.restRequests.length} requests</Pill>
            </div>
            <div className="space-y-3">
              {overview.restRequests.length ? (
                overview.restRequests.slice(0, 5).map((request) => (
                  <RestRequestCard
                    key={request.id}
                    request={request}
                    actingId={actingId}
                    onUpdateRestRequest={updateRestRequest}
                  />
                ))
              ) : (
                <EmptyState text="No active rest requests." />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#F3D7C8] bg-white/90 p-5 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-[#2F2C2A]">Worker IoT Signals</p>
            <p className="mt-1 text-sm text-[#776B63]">Each wearable shows only its current rest or SOS state.</p>
          </div>
          <span className="w-fit rounded-full bg-[#FFEFE6] px-3 py-1 text-xs font-semibold text-[#C95119]">Live every 5s</span>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {overview.devices.length ? (
            overview.devices.map((device) => <WorkerSignalCard key={device.id} device={device} overview={overview} activeIncidents={activeIncidents} />)
          ) : (
            <EmptyState text="No assigned IoT device records yet." />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#F3D7C8] bg-white/90 p-5 sm:p-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Emergency History</p>
            <p className="mt-1 text-sm text-[#776B63]">Recent SOS outcomes.</p>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF8F4] text-[#C95119]">
            <ClipboardCheck size={17} />
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl bg-[#FFF8F4]">
          {center.incidentHistory.length ? (
            center.incidentHistory.slice(0, 6).map((incident) => (
              <div key={incident.id} className="grid gap-4 border-b border-[#F3D7C8]/70 px-4 py-3 last:border-b-0 md:grid-cols-[120px_minmax(160px,1fr)_minmax(180px,1.2fr)_88px] md:items-center">
                <div>
                  <p className="text-xs font-semibold text-[#A09188]">Status</p>
                  <span className={`mt-1 inline-flex rounded px-2.5 py-1 text-xs font-semibold ${getIncidentStateClass(incident.state)}`}>
                    {formatStateLabel(incident.state)}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#A09188]">Worker</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#2F2C2A]">{incident.worker_id}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#A09188]">Device / Zone</p>
                  <p className="mt-1 truncate text-sm text-[#776B63]">{incident.device_id} / {incident.zone_id ?? 'No zone'}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#A09188]">Time</p>
                  <p className="mt-1 text-sm font-semibold text-[#776B63]">{formatTime(incident.opened_at)}</p>
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="No emergency history yet." />
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
    <div className={`grid h-24 flex-1 place-items-center rounded-2xl ${style}`}>
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
    <div className="rounded-2xl border border-[#F3D7C8] bg-white/75 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${toneClass}`}>
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

function IncidentSignalCard({
  incident,
  actingId,
  onUpdateIncident
}: {
  incident: IoTIncident;
  actingId: string | null;
  onUpdateIncident: (incidentId: string, action: 'acknowledge' | 'escalate' | 'resolve') => void;
}) {
  return (
    <div className="rounded-2xl border border-[#F3D7C8] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#2F2C2A]">{incident.worker_id}</p>
          <p className="mt-1 text-xs text-[#776B63]">{incident.device_id} / {incident.zone_id ?? 'No zone'} / {formatTime(incident.opened_at)}</p>
        </div>
        <Pill className={incident.state === 'ESCALATED' ? 'bg-[#FFEFE6] text-[#B84011]' : 'bg-[#FFF4DC] text-[#8A4B02]'}>
          {incident.state}
        </Pill>
      </div>
      <p className="mt-3 text-sm text-[#776B63]">Source: {incident.trigger_source.replaceAll('_', ' ').toLowerCase()} / Level {incident.escalation_level}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={Boolean(actingId)} onClick={() => onUpdateIncident(incident.id, 'acknowledge')} className="h-9 px-3">Acknowledge</Button>
        <Button disabled={Boolean(actingId)} onClick={() => onUpdateIncident(incident.id, 'escalate')} className="h-9 px-3">Escalate</Button>
        <Button disabled={Boolean(actingId)} variant="primary" onClick={() => onUpdateIncident(incident.id, 'resolve')} className="h-9 px-3">Resolve</Button>
      </div>
    </div>
  );
}

function RestRequestCard({
  request,
  actingId,
  onUpdateRestRequest
}: {
  request: RestRequest;
  actingId: string | null;
  onUpdateRestRequest: (requestId: string, action: 'approve' | 'reject') => void;
}) {
  const restScore = request.fatigue_score_at_request ?? request.risk_score_at_request;
  const isFinal = ['APPROVED', 'REJECTED', 'MANAGER_APPROVED', 'AUTO_APPROVED', 'AUTO_REJECTED'].includes(request.status);

  return (
    <div className="rounded-2xl border border-[#F3D7C8] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#2F2C2A]">{request.worker_id}</p>
          <p className="mt-1 text-xs text-[#776B63]">{request.device_id} / {request.zone_id ?? 'No zone'} / {formatTime(request.requested_at)}</p>
        </div>
        <Pill className={isFinal ? 'bg-[#F1F2F7] text-[#5F5A56]' : 'bg-[#FFF4DC] text-[#8A4B02]'}>
          {request.status}
        </Pill>
      </div>
      <p className="mt-3 text-sm text-[#776B63]">Fatigue score: {restScore} / Source: {request.source.replaceAll('_', ' ').toLowerCase()}</p>
      {request.decision_reason ? <p className="mt-2 text-xs text-[#A09188]">{request.decision_reason}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={Boolean(actingId) || isFinal} onClick={() => onUpdateRestRequest(request.id, 'reject')} className="h-9 px-3">Reject</Button>
        <Button disabled={Boolean(actingId) || isFinal} variant="primary" onClick={() => onUpdateRestRequest(request.id, 'approve')} className="h-9 px-3">Approve Rest</Button>
      </div>
    </div>
  );
}

function WorkerSignalCard({ device, overview, activeIncidents }: { device: IoTDevice; overview: IoTOverview; activeIncidents: IoTIncident[] }) {
  const sos = activeIncidents.find((incident) => incident.device_id === device.id);
  const rest = overview.restRequests.find((request) => request.device_id === device.id);
  const hasSignal = Boolean(sos || rest);
  const cardTone = sos ? 'border-[#FD7124] bg-[#FFF8F4]' : rest ? 'border-[#F5CC87] bg-[#FFFDF8]' : 'border-[#F3D7C8] bg-white';
  const statusLabel = sos ? 'SOS active' : rest ? 'Rest requested' : 'Clear';

  return (
    <div className={`rounded-3xl border p-5 shadow-[0_16px_50px_rgba(76,48,35,0.07)] ${cardTone}`}>
      <div className="grid gap-5 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
        <div className="grid place-items-center rounded-3xl bg-white px-4 py-6">
          <span className={`grid h-20 w-20 place-items-center rounded-full ${device.status === 'ONLINE' ? 'bg-[#FFEFE6] text-[#FD7124]' : 'bg-[#F1F2F7] text-[#776B63]'}`}>
            {device.status === 'ONLINE' ? <Radio size={32} /> : <WifiOff size={32} />}
          </span>
          <p className="mt-4 text-center text-sm font-semibold text-[#2F2C2A]">{device.status === 'ONLINE' ? 'Connected' : 'Offline'}</p>
          <p className="mt-1 text-center text-xs text-[#A09188]">{device.name}</p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-[#2F2C2A]">{device.assignedWorkerId ?? 'Unassigned worker'}</p>
              <p className="mt-1 text-sm text-[#776B63]">{device.assignedZoneId ?? 'No zone'}</p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${hasSignal ? 'bg-[#FFEFE6] text-[#B84011]' : 'bg-[#EAF5ED] text-[#55936A]'}`}>
              {statusLabel}
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className={`min-h-[128px] rounded-3xl px-5 py-5 ${sos ? 'bg-[#FFEFE6]' : 'bg-white'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-2xl ${sos ? 'bg-white text-[#B84011]' : 'bg-[#FFF8F4] text-[#A09188]'}`}>
                  <ShieldAlert size={20} />
                </span>
                <span className="text-xs font-semibold text-[#A09188]">SOS</span>
              </div>
              <p className={`mt-4 text-xl font-semibold ${sos ? 'text-[#B84011]' : 'text-[#2F2C2A]'}`}>{sos ? 'Active' : 'None'}</p>
              <p className="mt-1 text-sm text-[#776B63]">{sos ? formatTime(sos.opened_at) : 'No emergency signal'}</p>
            </div>

            <div className={`min-h-[128px] rounded-3xl px-5 py-5 ${rest ? 'bg-[#FFF4DC]' : 'bg-white'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-2xl ${rest ? 'bg-white text-[#8A4B02]' : 'bg-[#FFF8F4] text-[#A09188]'}`}>
                  <TimerReset size={20} />
                </span>
                <span className="text-xs font-semibold text-[#A09188]">REST</span>
              </div>
              <p className={`mt-4 text-xl font-semibold ${rest ? 'text-[#8A4B02]' : 'text-[#2F2C2A]'}`}>{rest ? 'Requested' : 'None'}</p>
              <p className="mt-1 text-sm text-[#776B63]">{rest ? formatTime(rest.requested_at) : 'No break request'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl bg-[#FFF8F4] px-3 py-3 text-sm text-[#776B63]">{text}</p>;
}

function getIncidentStateClass(state: string) {
  if (state === 'RESOLVED') {
    return 'bg-[#EAF5ED] text-[#55936A]';
  }

  if (state === 'ESCALATED') {
    return 'bg-[#FFEFE6] text-[#B84011]';
  }

  return 'bg-white text-[#776B63]';
}

function formatStateLabel(state: string) {
  return state
    .split('_')
    .map((part) => `${part.charAt(0)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
