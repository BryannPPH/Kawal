import { ClipboardCheck, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Pill } from '../../../components/ui/Pill';
import type { IncidentCenterData, IoTIncident } from '../../../types/iot';

const emptyCenter: IncidentCenterData = {
  activeIncidents: [],
  incidentHistory: [],
  nearMissReports: []
};

export function IncidentCenterView() {
  const [data, setData] = useState<IncidentCenterData>(emptyCenter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCenter = async () => {
    try {
      const response = await fetch('/api/incidents/center');

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      setData((await response.json()) as IncidentCenterData);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load incident center');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCenter();
    const timer = window.setInterval(loadCenter, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const updateIncident = async (incidentId: string, action: 'acknowledge' | 'escalate' | 'resolve') => {
    await fetch(`/api/incidents/${incidentId}/${action}`, {
      method: 'POST'
    });
    loadCenter();
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-[#F3D7C8] bg-white">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="p-6 sm:p-7">
            <p className="text-sm font-semibold text-[#C95119]">Incident Center</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-[#2F2C2A]">Focus on the alerts that need a decision.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#776B63]">Active SOS, near-miss reports, and emergency history stay separated so managers can act without scanning dense data.</p>
          </div>
          <div className="border-t border-[#F3D7C8] bg-[#FFF8F4] p-6 xl:border-l xl:border-t-0">
            <div className="grid grid-cols-3 gap-3">
              <CenterStat label="SOS" value={data.activeIncidents.length} tone="danger" />
              <CenterStat label="Near miss" value={data.nearMissReports.length} tone="warning" />
              <CenterStat label="History" value={data.incidentHistory.length} tone="neutral" />
            </div>
            <div className="mt-5 rounded-2xl bg-white p-4">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${data.activeIncidents.length ? 'bg-[#CF5A4F]' : 'bg-[#55936A]'}`} />
                <p className="text-sm font-semibold text-[#2F2C2A]">{data.activeIncidents.length ? 'Action needed' : 'No active SOS'}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#776B63]">Use acknowledge, escalate, or resolve only when an incident is active.</p>
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl bg-[#FFF4DC] px-3 py-2 text-sm font-semibold text-[#8A4B02]">Incident Center API unavailable: {error}</p> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-[#F3D7C8] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#2F2C2A]">Active SOS Alerts</p>
              <p className="mt-1 text-sm text-[#776B63]">Managers can acknowledge, escalate, or resolve active incidents.</p>
            </div>
            <Pill className="bg-[#FFEFE6] text-[#B84011]">SOS</Pill>
          </div>

          <div className="mt-5 space-y-3">
            {data.activeIncidents.length ? (
              data.activeIncidents.map((incident) => (
                <IncidentCard key={incident.id} incident={incident} onAction={updateIncident} />
              ))
            ) : (
              <EmptyState loading={loading} text="No active SOS alerts." />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#F3D7C8] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#2F2C2A]">Near-Miss Reports</p>
              <p className="mt-1 text-sm text-[#776B63]">Motion telemetry requiring safety review.</p>
            </div>
            <Radio size={18} className="text-[#FAA745]" />
          </div>

          <div className="mt-5 space-y-3">
            {data.nearMissReports.length ? (
              data.nearMissReports.map((report) => (
                <div key={report.id} className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#2F2C2A]">{report.worker_id ?? report.device_id}</p>
                    <Pill className="bg-[#FFEFE6] text-[#B84011]">{report.fall_candidate ? 'Fall candidate' : 'Impact'}</Pill>
                  </div>
                  <p className="mt-2 text-sm text-[#776B63]">{report.zone_id ?? 'Unknown zone'} / {report.maximum_acceleration_g}G peak</p>
                  <p className="mt-1 text-xs font-semibold text-[#A09188]">{formatTime(report.window_end)}</p>
                </div>
              ))
            ) : (
              <EmptyState loading={loading} text="No near-miss reports." />
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#F3D7C8] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Emergency History</p>
            <p className="mt-1 text-sm text-[#776B63]">Resolved and escalated incidents remain visible for manager review.</p>
          </div>
          <ClipboardCheck size={18} className="text-[#FAA745]" />
        </div>

        <div className="mt-5 space-y-3">
          {data.incidentHistory.length ? (
            data.incidentHistory.map((incident) => (
              <div key={incident.id} className="grid gap-3 rounded-2xl border border-[#F3D7C8] p-4 md:grid-cols-[minmax(0,1fr)_150px_130px] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#2F2C2A]">{incident.trigger_source}</p>
                  <p className="mt-1 text-sm text-[#776B63]">{incident.worker_id} / {incident.zone_id ?? 'Unknown zone'}</p>
                </div>
                <Pill className={incident.state === 'OPEN' ? 'bg-[#FFEFE6] text-[#B84011]' : 'bg-[#FFF7ED] text-[#9A5719]'}>{incident.state}</Pill>
                <p className="text-sm font-semibold text-[#5F5A56]">{formatTime(incident.opened_at)}</p>
              </div>
            ))
          ) : (
            <EmptyState loading={loading} text="No emergency history yet." />
          )}
        </div>
      </section>
    </div>
  );
}

function CenterStat({ label, value, tone }: { label: string; value: number; tone: 'danger' | 'warning' | 'neutral' }) {
  const styles = {
    danger: 'bg-[#FFEFE6] text-[#B84011]',
    warning: 'bg-[#FFF4DC] text-[#8A4B02]',
    neutral: 'bg-white text-[#5F5A56]'
  }[tone];

  return (
    <div className={`rounded-2xl p-4 text-center ${styles}`}>
      <p className="text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
    </div>
  );
}

function IncidentCard({
  incident,
  onAction
}: {
  incident: IoTIncident;
  onAction: (incidentId: string, action: 'acknowledge' | 'escalate' | 'resolve') => void;
}) {
  return (
    <div className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Pill className="bg-[#FFEFE6] text-[#B84011]">{incident.state}</Pill>
            <Pill className="bg-[#FFF4DC] text-[#8A4B02]">Escalation {incident.escalation_level}</Pill>
          </div>
          <p className="mt-3 text-sm font-semibold text-[#2F2C2A]">{incident.worker_id} / {incident.zone_id ?? 'Unknown zone'}</p>
          <p className="mt-1 text-sm text-[#776B63]">{incident.trigger_source} opened {formatTime(incident.opened_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onAction(incident.id, 'acknowledge')}>Acknowledge</Button>
          <Button onClick={() => onAction(incident.id, 'escalate')}>Escalate</Button>
          <Button variant="primary" onClick={() => onAction(incident.id, 'resolve')}>Resolve</Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ loading, text }: { loading: boolean; text: string }) {
  return <p className="rounded-xl bg-[#FFF8F4] px-3 py-3 text-sm text-[#776B63]">{loading ? 'Loading...' : text}</p>;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
