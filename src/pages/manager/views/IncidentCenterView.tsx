import { AlertTriangle, ClipboardCheck, History, Radio, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Pill } from '../../../components/ui/Pill';
import type { IncidentCenterData, IoTIncident } from '../../../types/iot';
import { MetricCard } from '../components/MetricCard';

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
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Active SOS" value={String(data.activeIncidents.length)} detail="Open emergency alerts" icon={ShieldAlert} />
        <MetricCard label="Near Miss" value={String(data.nearMissReports.length)} detail="Impact or fall-candidate reports" icon={AlertTriangle} />
        <MetricCard label="History" value={String(data.incidentHistory.length)} detail="Emergency records retained" icon={History} />
      </div>

      {error ? <p className="rounded-md bg-[#FFF4DC] px-3 py-2 text-sm font-semibold text-[#8A4B02]">Incident Center API unavailable: {error}</p> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-[#F3D7C8] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#2F2C2A]">Active SOS Alerts</p>
              <p className="mt-1 text-sm text-[#776B63]">Managers and HSE can acknowledge, escalate, or resolve active incidents.</p>
            </div>
            <Pill className="bg-[#FFEFE6] text-[#B84011]">FR-SOS</Pill>
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

        <div className="rounded-lg border border-[#F3D7C8] bg-white p-5">
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
                <div key={report.id} className="rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] p-4">
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

      <section className="rounded-lg border border-[#F3D7C8] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Emergency History</p>
            <p className="mt-1 text-sm text-[#776B63]">Resolved and escalated incidents remain visible for review under FR-INC.</p>
          </div>
          <ClipboardCheck size={18} className="text-[#FAA745]" />
        </div>

        <div className="mt-5 space-y-3">
          {data.incidentHistory.length ? (
            data.incidentHistory.map((incident) => (
              <div key={incident.id} className="grid gap-3 rounded-lg border border-[#F3D7C8] p-4 md:grid-cols-[minmax(0,1fr)_150px_130px] md:items-center">
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

function IncidentCard({
  incident,
  onAction
}: {
  incident: IoTIncident;
  onAction: (incidentId: string, action: 'acknowledge' | 'escalate' | 'resolve') => void;
}) {
  return (
    <div className="rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] p-4">
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
  return <p className="rounded-md bg-[#FFF8F4] px-3 py-3 text-sm text-[#776B63]">{loading ? 'Loading...' : text}</p>;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
