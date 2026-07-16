import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  ClipboardCheck,
  Home,
  LogOut,
  MapPin,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  Camera,
  TimerReset,
  User,
  UserRoundCheck
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import kawalLogo from '../../assets/kawal-logo.svg';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import type { AuthUser } from '../../types/navigation';
import type { Notification, Task, Worker } from '../../types/workforce';
import { ProcedureStep } from './components/ProcedureStep';

type WorkerPageProps = {
  user: AuthUser | null;
  onLogout: () => void;
};

type WorkerTab = 'home' | 'tasks' | 'report' | 'profile';
type SosStage = 'idle' | 'sending' | 'sent' | 'failed';

type PpeCheckResult = {
  id: string;
  helmetDetected: boolean;
  harnessDetected: boolean;
  confidence: number;
  status: 'PASSED' | 'FAILED' | 'REVIEW';
  provider: string;
  reason: string;
  checkedAt: string;
};

type WorkerAppData = {
  worker: Worker | null;
  tasks: Task[];
  notifications: Notification[];
  currentBreak: {
    ends_at?: string;
    endsAt?: string;
    planned_minutes?: number;
    plannedMinutes?: number;
  } | null;
  latestRisk: {
    risk_score?: number;
    riskScore?: number;
    risk_level?: string;
    riskLevel?: string;
    reasons?: string;
  } | null;
  activeIncident: {
    id: string;
    state: string;
    opened_at?: string;
    openedAt?: string;
  } | null;
  latestPpeCheck?: PpeCheckResult | null;
  ppeCheck?: PpeCheckResult;
};

const emptyAppData: WorkerAppData = {
  worker: null,
  tasks: [],
  notifications: [],
  currentBreak: null,
  latestRisk: null,
  activeIncident: null
};

const hazardTypes = ['Missing PPE', 'Wet Floor', 'Equipment', 'Scaffold', 'Restricted Area', 'Heat Stress'];
const ppeScanSteps = ['Scanning helmet', 'Scanning harness', 'Checking visibility', 'Finalizing result'];

export function WorkerPage({ user, onLogout }: WorkerPageProps) {
  const [activeTab, setActiveTab] = useState<WorkerTab>('home');
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [data, setData] = useState<WorkerAppData>(emptyAppData);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [sosStage, setSosStage] = useState<SosStage>('idle');
  const [ppeModalOpen, setPpeModalOpen] = useState(false);
  const [ppeBusy, setPpeBusy] = useState(false);
  const [ppeError, setPpeError] = useState<string | null>(null);
  const [ppeCapturedImage, setPpeCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hazardType, setHazardType] = useState(hazardTypes[0]);
  const [hazardNote, setHazardNote] = useState('');

  const currentTask = data.tasks[0];
  const worker = data.worker;
  const riskScore = data.latestRisk?.risk_score ?? data.latestRisk?.riskScore ?? Math.max(worker?.fatigue ?? 0, data.activeIncident ? 92 : 28);
  const riskLevel = data.activeIncident ? 'CRITICAL' : data.latestRisk?.risk_level ?? data.latestRisk?.riskLevel ?? (riskScore >= 65 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW');
  const unreadCount = data.notifications.filter((notification) => !notification.read).length;

  const workerInitials = useMemo(() => {
    const name = worker?.name ?? user?.name ?? 'Worker';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [user?.name, worker?.name]);

  useEffect(() => {
    let cancelled = false;

    async function resolveWorker() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/workforce');

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const workforce = (await response.json()) as { workers: Worker[] };
        const matchedWorker = workforce.workers.find((item) => item.name.toLowerCase() === user?.name.toLowerCase()) ?? workforce.workers[0];

        if (!matchedWorker) {
          throw new Error('No worker profile found');
        }

        if (!cancelled) {
          setWorkerId(matchedWorker.id);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to resolve worker profile');
          setLoading(false);
        }
      }
    }

    resolveWorker();

    return () => {
      cancelled = true;
    };
  }, [user?.name]);

  useEffect(() => {
    if (!workerId) {
      return;
    }

    loadWorkerApp(workerId);
    const timer = window.setInterval(() => loadWorkerApp(workerId, false), 5000);
    return () => window.clearInterval(timer);
  }, [workerId]);

  const loadWorkerApp = async (nextWorkerId = workerId, showLoading = true) => {
    if (!nextWorkerId) {
      return;
    }

    if (showLoading) {
      setLoading(true);
    }

    try {
      const response = await fetch(`/api/workers/${nextWorkerId}/app`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      setData((await response.json()) as WorkerAppData);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load worker app');
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (action: string, options: RequestInit = {}, successMessage: string) => {
    if (!workerId) {
      return;
    }

    setBusyAction(action);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/workers/${workerId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {})
        },
        ...options
      });

      const payload = (await response.json()) as WorkerAppData | { error?: string };

      if (!response.ok || 'error' in payload) {
        throw new Error('error' in payload ? payload.error ?? 'Action failed' : 'Action failed');
      }

      setData(payload as WorkerAppData);
      setMessage(successMessage);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Action failed');
    } finally {
      setBusyAction(null);
    }
  };

  const submitStatus = (status: 'waiting' | 'working' | 'break' | 'done') => {
    runAction('status', { body: JSON.stringify({ status }) }, status === 'working' ? 'Shift started.' : status === 'waiting' ? 'Task paused.' : 'Status updated.');
  };

  const acceptAssignment = () => {
    runAction('accept', { body: JSON.stringify({ taskId: currentTask?.id }) }, 'Assignment accepted. Complete PPE check to start.');
  };

  const startTaskWithPpe = () => {
    setPpeError(null);
    setPpeModalOpen(true);
  };

  const submitPpeImage = async (imageDataUrl: string) => {
    if (!workerId) {
      return;
    }

    setPpeCapturedImage(imageDataUrl);
    setPpeBusy(true);
    setPpeError(null);
    setError(null);
    setMessage(null);

    try {
      const [response] = await Promise.all([
        fetch(`/api/workers/${workerId}/ppe-check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ imageDataUrl })
        }),
        wait(2600)
      ]);
      const payload = (await response.json()) as WorkerAppData | { error?: string };

      if (!response.ok || 'error' in payload) {
        throw new Error('error' in payload ? payload.error ?? 'PPE check failed' : 'PPE check failed');
      }

      const check = (payload as WorkerAppData).ppeCheck ?? (payload as WorkerAppData).latestPpeCheck;
      setData(payload as WorkerAppData);

      if (check?.status !== 'PASSED') {
        setPpeError(check?.reason ?? 'Helmet and harness could not be verified.');
        return;
      }

      setPpeModalOpen(false);
      setPpeCapturedImage(null);
      await runAction('status', { body: JSON.stringify({ status: 'working' }) }, 'PPE verified. Shift started.');
    } catch (caughtError) {
      setPpeError(caughtError instanceof Error ? caughtError.message : 'PPE check failed');
    } finally {
      setPpeBusy(false);
    }
  };

  const submitHazard = () => {
    runAction(
      'hazards',
      {
        body: JSON.stringify({
          hazardType,
          note: hazardNote
        })
      },
      'Hazard report sent to manager.'
    );
    setHazardNote('');
  };

  const triggerSos = async () => {
    if (!workerId || busyAction === 'sos') {
      return;
    }

    setActiveTab('home');
    setBusyAction('sos');
    setSosStage('sending');
    setError(null);
    setMessage(null);
    vibrateSos();

    try {
      const response = await fetch(`/api/workers/${workerId}/sos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const payload = (await response.json()) as WorkerAppData | { error?: string };

      if (!response.ok || 'error' in payload) {
        throw new Error('error' in payload ? payload.error ?? 'SOS failed' : 'SOS failed');
      }

      setData(payload as WorkerAppData);
      setSosStage('sent');
      setMessage('SOS sent. Manager Incident Center has been notified.');
      window.setTimeout(() => setSosStage('idle'), 3600);
    } catch (caughtError) {
      setSosStage('failed');
      setError(caughtError instanceof Error ? caughtError.message : 'SOS failed');
      window.setTimeout(() => setSosStage('idle'), 4200);
    } finally {
      setBusyAction(null);
    }
  };

  const navItems = [
    { tab: 'home' as const, label: 'Home', icon: Home },
    { tab: 'tasks' as const, label: 'Tasks', icon: ClipboardCheck },
    { tab: 'report' as const, label: 'Report', icon: MessageSquareWarning },
    { tab: 'profile' as const, label: 'Profile', icon: User }
  ];

  return (
    <section className="grid min-h-dvh place-items-center bg-[#F1F2F7] p-3 text-[#2F2C2A] sm:p-6">
      <div className="relative flex h-[calc(100dvh-1.5rem)] min-h-[760px] w-full max-w-[430px] flex-col overflow-hidden rounded-[2.75rem] border-[4px] border-[#1F1D1B] bg-[#FFFDFB] shadow-[0_28px_90px_rgba(47,44,42,0.22)] sm:h-[920px] sm:max-h-[calc(100dvh-3rem)]">
        <div className="absolute left-1/2 top-3 z-30 flex h-8 w-28 -translate-x-1/2 items-center justify-end rounded-full bg-[#111111] px-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.16),0_2px_8px_rgba(17,17,17,0.22)]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2B2B2B]" />
        </div>

        <header className="z-20 flex items-center justify-between gap-3 bg-[#FFFDFB] px-5 pb-4 pt-14">
          <div className="flex min-w-0 items-center gap-3">
            <img src={kawalLogo} alt="Kawal logo" className="h-10 w-10 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#2F2C2A]">{worker?.name ?? user?.name ?? 'Worker'}</p>
              <p className="truncate text-xs text-[#776B63]">{worker ? `${worker.zone} / ${worker.role}` : 'Loading profile'}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Logout"
            title="Logout"
            onClick={onLogout}
            className="grid h-10 w-10 place-items-center rounded-md border border-[#F3D7C8] bg-white text-[#776B63] transition hover:bg-[#FFEFE6] hover:text-[#2F2C2A]"
          >
            <LogOut size={17} />
          </button>
        </header>

        <div className="bg-[#FFFDFB] px-5">
          {error ? <p className="mt-3 rounded-md bg-[#FFEFE6] px-3 py-2 text-sm font-semibold text-[#B84011]">{error}</p> : null}
          {message ? <p className="mt-3 rounded-md bg-[#FFF7ED] px-3 py-2 text-sm font-semibold text-[#9A5719]">{message}</p> : null}
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto bg-[#FFFDFB] px-5 pb-28 pt-3">
          {loading && !worker ? <LoadingState /> : null}
          {!loading && !worker ? <EmptyState text="No worker profile is assigned to this login." /> : null}
          {worker && activeTab === 'home' ? (
            <HomePanel
              worker={worker}
              task={currentTask}
              riskLevel={riskLevel}
              riskScore={riskScore}
              currentBreak={data.currentBreak}
              activeIncident={data.activeIncident}
              latestPpeCheck={data.latestPpeCheck ?? null}
              busyAction={busyAction}
              onAccept={acceptAssignment}
              onStart={startTaskWithPpe}
              onPause={() => submitStatus('waiting')}
              onRest={() => runAction('rest-request', {}, 'Rest request sent.')}
              onComplete={() => runAction('complete', {}, 'Assignment sent for review.')}
            />
          ) : null}
          {worker && activeTab === 'tasks' ? <TasksPanel tasks={data.tasks} worker={worker} busyAction={busyAction} onAccept={(taskId) => runAction('accept', { body: JSON.stringify({ taskId }) }, 'Assignment accepted.')} /> : null}
          {worker && activeTab === 'report' ? (
            <ReportPanel
              hazardType={hazardType}
              hazardNote={hazardNote}
              busyAction={busyAction}
              onSetHazardType={setHazardType}
              onSetHazardNote={setHazardNote}
              onSubmit={submitHazard}
            />
          ) : null}
          {worker && activeTab === 'profile' ? (
            <ProfilePanel
              worker={worker}
              initials={workerInitials}
              unreadCount={unreadCount}
              notifications={data.notifications}
              currentBreak={data.currentBreak}
              latestRisk={data.latestRisk}
              activeIncident={data.activeIncident}
            />
          ) : null}
        </main>

        {sosStage !== 'idle' ? <SosOverlay stage={sosStage} workerName={worker?.name ?? user?.name ?? 'Worker'} zone={worker?.zone ?? 'current zone'} /> : null}
        {ppeModalOpen ? (
          <PpeCameraModal
            busy={ppeBusy}
            error={ppeError}
            capturedImage={ppeCapturedImage}
            onClose={() => {
              if (!ppeBusy) {
                setPpeModalOpen(false);
                setPpeCapturedImage(null);
              }
            }}
            onCapture={submitPpeImage}
            onRetake={() => {
              if (!ppeBusy) {
                setPpeCapturedImage(null);
                setPpeError(null);
              }
            }}
          />
        ) : null}

        <nav className="absolute bottom-0 left-0 z-30 grid h-[82px] w-full grid-cols-5 items-center border-t border-[#F3D7C8] bg-white px-2 shadow-[0_-12px_36px_rgba(76,48,35,0.12)]">
          {navItems.slice(0, 2).map(({ tab, label, icon: Icon }) => (
            <WorkerNavButton key={tab} active={activeTab === tab} label={label} icon={Icon} onClick={() => setActiveTab(tab)} />
          ))}
          <button
            type="button"
            aria-label="Send SOS"
            title="Send SOS"
            disabled={busyAction === 'sos' || !worker}
            onClick={triggerSos}
            className={`relative mx-auto grid h-16 w-16 -translate-y-5 place-items-center rounded-full bg-[#B84011] text-white shadow-[0_12px_28px_rgba(184,64,17,0.34)] outline-none transition hover:bg-[#9F3410] focus-visible:ring-2 focus-visible:ring-[#FD7124] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${busyAction === 'sos' ? 'animate-pulse ring-4 ring-[#FFEFE6]' : ''}`}
          >
            {busyAction === 'sos' ? <span className="absolute inset-0 rounded-full bg-[#B84011] opacity-35 animate-ping" /> : null}
            <span className="relative flex flex-col items-center leading-none">
              <ShieldAlert size={22} />
              <span className="mt-1 text-[10px] font-black tracking-[0.12em]">SOS</span>
            </span>
            <span className="sr-only">SOS</span>
          </button>
          {navItems.slice(2).map(({ tab, label, icon: Icon }) => (
            <WorkerNavButton key={tab} active={activeTab === tab} label={label} icon={Icon} onClick={() => setActiveTab(tab)} />
          ))}
        </nav>
      </div>
    </section>
  );
}

function HomePanel({
  worker,
  task,
  riskLevel,
  riskScore,
  currentBreak,
  activeIncident,
  latestPpeCheck,
  busyAction,
  onAccept,
  onStart,
  onPause,
  onRest,
  onComplete
}: {
  worker: Worker;
  task?: Task;
  riskLevel: string;
  riskScore: number;
  currentBreak: WorkerAppData['currentBreak'];
  activeIncident: WorkerAppData['activeIncident'];
  latestPpeCheck: PpeCheckResult | null;
  busyAction: string | null;
  onAccept: () => void;
  onStart: () => void;
  onPause: () => void;
  onRest: () => void;
  onComplete: () => void;
}) {
  const working = worker.status === 'working';
  const assignmentPending = task?.status === 'Assigned';
  const assignmentAccepted = Boolean(task && ['Accepted', 'In progress', 'Review'].includes(task.status)) || working || worker.status === 'done';

  return (
    <div className="flex min-h-full flex-col space-y-4">
      <section className="rounded-lg bg-[#FD7124] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/75">Current Assignment</p>
            <h1 className="mt-2 truncate text-2xl font-semibold tracking-normal">{task?.title ?? worker.task}</h1>
            <p className="mt-2 text-sm text-white/85">{task?.project ?? 'Kawal Site'} / {worker.zone}</p>
          </div>
          <Pill className="bg-white/20 text-white">{assignmentPending ? 'New Assignment' : `${riskLevel} Risk`}</Pill>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
          <MetricBox label="Duration" value={worker.time} />
          <MetricBox label="Risk" value={`${riskScore}%`} />
          <MetricBox label="Earning" value={worker.pay.replace('Rp', 'Rp')} />
        </div>
        {activeIncident ? <p className="mt-4 rounded-md bg-white/15 px-3 py-2 text-sm font-semibold">SOS active: {activeIncident.state}</p> : null}
        {currentBreak ? <p className="mt-4 rounded-md bg-white/15 px-3 py-2 text-sm font-semibold">Break active until {formatTime(currentBreak.ends_at ?? currentBreak.endsAt)}</p> : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#2F2C2A]">Safety Checklist</p>
          <Pill className={latestPpeCheck?.status === 'PASSED' ? 'bg-[#FFF7ED] text-[#9A5719]' : 'bg-[#FFEFE6] text-[#B84011]'}>
            {latestPpeCheck?.status === 'PASSED' ? 'PPE verified' : 'PPE needed'}
          </Pill>
        </div>
        <ul className="space-y-2">
          <ProcedureStep done={working || worker.status === 'done'} icon={UserRoundCheck} label="Checked in for assigned zone" />
          <ProcedureStep done={assignmentAccepted} icon={ClipboardCheck} label="Assignment accepted" />
          <ProcedureStep done={latestPpeCheck?.status === 'PASSED'} icon={ShieldCheck} label="Helmet and harness verified by camera" />
          <ProcedureStep done={Boolean(task)} icon={MapPin} label="Task and location confirmed" />
          <ProcedureStep done={worker.status === 'done'} icon={BriefcaseBusiness} label="Completion sent for review" />
        </ul>
        {latestPpeCheck ? (
          <p className="mt-3 rounded-md bg-[#FFF8F4] px-3 py-2 text-xs font-semibold text-[#776B63]">
            {latestPpeCheck.provider === 'demo' ? 'Demo PPE check' : 'AI PPE check'} / {Math.round(latestPpeCheck.confidence * 100)}% confidence
          </p>
        ) : null}
      </section>

      <section className="mt-auto grid gap-2 pt-2">
        {assignmentPending ? (
          <Button variant="primary" className="h-12" onClick={onAccept} disabled={busyAction === 'accept'}>
            <ClipboardCheck size={16} />
            Accept Assignment
          </Button>
        ) : (
          <Button
            variant={working ? 'secondary' : 'primary'}
            className="h-12"
            onClick={working ? onPause : onStart}
            disabled={busyAction === 'status' || !assignmentAccepted || !task}
          >
            {working ? 'Pause Task' : 'Start Task'}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onRest} disabled={busyAction === 'rest-request'}>
            <TimerReset size={16} />
            Request Rest
          </Button>
          <Button variant="primary" onClick={onComplete} disabled={busyAction === 'complete'}>
            <ClipboardCheck size={16} />
            Complete
          </Button>
        </div>
      </section>
    </div>
  );
}

function TasksPanel({
  tasks,
  worker,
  busyAction,
  onAccept
}: {
  tasks: Task[];
  worker: Worker;
  busyAction: string | null;
  onAccept: (taskId: string) => void;
}) {
  return (
    <section className="min-h-full">
      <div className="mb-4">
        <p className="text-sm font-semibold text-[#2F2C2A]">Assigned Tasks</p>
        <p className="mt-1 text-sm text-[#776B63]">{worker.name} / {worker.zone}</p>
      </div>
      <div className="space-y-3">
        {tasks.length ? (
          tasks.map((task) => (
            <div key={task.id} className="rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#2F2C2A]">{task.title}</p>
                  <p className="mt-1 text-sm text-[#776B63]">{task.project} / {task.zone}</p>
                </div>
                <Pill className={task.tone === 'danger' ? 'bg-[#FFEFE6] text-[#B84011]' : 'bg-[#FFF7ED] text-[#9A5719]'}>
                  {task.status}
                </Pill>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <InfoBox label="Qty" value={`${task.quantity} ${task.unit}`} />
                <InfoBox label="Due" value={task.deadline} />
                <InfoBox label="Priority" value={task.priority} />
              </div>
              {task.schedulerRecommendation.safetyAndOperationalWarnings.length ? (
                <p className="mt-3 rounded-md bg-white px-3 py-2 text-xs font-semibold text-[#8A4B02]">
                  {task.schedulerRecommendation.safetyAndOperationalWarnings[0]}
                </p>
              ) : null}
              {task.status === 'Assigned' ? (
                <Button variant="primary" className="mt-3 h-10 w-full" onClick={() => onAccept(task.id)} disabled={busyAction === 'accept'}>
                  <ClipboardCheck size={16} />
                  Accept Assignment
                </Button>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState text="No assigned task yet." />
        )}
      </div>
    </section>
  );
}

function ReportPanel({
  hazardType,
  hazardNote,
  busyAction,
  onSetHazardType,
  onSetHazardNote,
  onSubmit
}: {
  hazardType: string;
  hazardNote: string;
  busyAction: string | null;
  onSetHazardType: (value: string) => void;
  onSetHazardNote: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="min-h-full">
      <div className="mb-4">
        <p className="text-sm font-semibold text-[#2F2C2A]">Report Hazard</p>
        <p className="mt-1 text-sm text-[#776B63]">Report will appear in the manager alert bell and Workers page.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {hazardTypes.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSetHazardType(item)}
            className={`min-h-10 rounded-md border px-2 text-sm font-semibold ${
              hazardType === item ? 'border-[#FD7124] bg-[#FFEFE6] text-[#B84011]' : 'border-[#F3D7C8] bg-white text-[#5F5A56]'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <textarea
        value={hazardNote}
        onChange={(event) => onSetHazardNote(event.target.value)}
        className="mt-3 min-h-28 w-full rounded-md border border-[#F3D7C8] bg-[#FFF8F4] px-3 py-3 text-sm font-medium text-[#2F2C2A] outline-none transition placeholder:text-[#A09188] focus:border-[#FD7124] focus:bg-white focus:ring-2 focus:ring-[#FFEFE6]"
        placeholder="Add location detail or what happened"
      />
      <Button variant="primary" className="mt-3 h-11 w-full" onClick={onSubmit} disabled={busyAction === 'hazards'}>
        <AlertTriangle size={16} />
        Send Report
      </Button>
    </section>
  );
}

function ProfilePanel({
  worker,
  initials,
  unreadCount,
  notifications,
  currentBreak,
  latestRisk,
  activeIncident
}: {
  worker: Worker;
  initials: string;
  unreadCount: number;
  notifications: Notification[];
  currentBreak: WorkerAppData['currentBreak'];
  latestRisk: WorkerAppData['latestRisk'];
  activeIncident: WorkerAppData['activeIncident'];
}) {
  return (
    <section className="min-h-full space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] p-4">
        <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#FD7124] text-sm font-bold text-white">{initials}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#2F2C2A]">{worker.name}</p>
          <p className="mt-1 truncate text-sm text-[#776B63]">{worker.role} / {worker.zone}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <InfoBox label="Status" value={worker.status} />
        <InfoBox label="Fatigue" value={`${worker.fatigue}%`} />
        <InfoBox label="Match" value={`${worker.match}%`} />
        <InfoBox label="Pay" value={worker.pay} />
      </div>
      <div className="rounded-lg border border-[#F3D7C8] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#2F2C2A]">Signals</p>
          <Pill className="bg-[#FFEFE6] text-[#C95119]">{unreadCount} unread</Pill>
        </div>
        <div className="mt-3 space-y-2 text-sm text-[#776B63]">
          <p>Break: {currentBreak ? `Active until ${formatTime(currentBreak.ends_at ?? currentBreak.endsAt)}` : 'No active break'}</p>
          <p>Risk: {latestRisk ? `${latestRisk.risk_level ?? latestRisk.riskLevel} / ${latestRisk.risk_score ?? latestRisk.riskScore}` : 'No risk evaluation yet'}</p>
          <p>Incident: {activeIncident ? activeIncident.state : 'No active SOS'}</p>
        </div>
      </div>
      <div className="rounded-lg border border-[#F3D7C8] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Bell size={16} className="text-[#FD7124]" />
          <p className="text-sm font-semibold text-[#2F2C2A]">Manager Updates</p>
        </div>
        <div className="space-y-2">
          {notifications.length ? (
            notifications.slice(0, 4).map((notification) => (
              <div key={notification.id} className="rounded-md bg-[#FFF8F4] px-3 py-2">
                <p className="text-sm font-semibold text-[#2F2C2A]">{notification.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#776B63]">{notification.detail}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-[#776B63]">No updates yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function WorkerNavButton({
  active,
  label,
  icon: Icon,
  onClick
}: {
  active: boolean;
  label: string;
  icon: typeof Home;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-md py-2 text-[11px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#FD7124] focus-visible:ring-offset-2 ${
        active ? 'bg-[#FFEFE6] text-[#B84011]' : 'text-[#776B63] hover:bg-[#FFF8F4]'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function SosOverlay({ stage, workerName, zone }: { stage: SosStage; workerName: string; zone: string }) {
  const failed = stage === 'failed';

  return (
    <div
      aria-label={failed ? `SOS failed for ${workerName} at ${zone}` : `SOS active for ${workerName} at ${zone}`}
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden bg-[#B84011]/18 backdrop-blur-[1px]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(253,113,36,0.32),rgba(184,64,17,0.16)_30%,rgba(184,64,17,0)_68%)]" />
      <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#B84011] shadow-[0_0_32px_rgba(184,64,17,0.75)]" />
      {[0, 1, 2, 3, 4].map((wave) => (
        <span
          key={wave}
          className="sos-wave"
          style={{ animationDelay: `${wave * 260}ms` }}
        />
      ))}
      {failed ? (
        <div className="absolute inset-0 bg-[#2F2C2A]/15" />
      ) : null}
      </div>
  );
}

function PpeCameraModal({
  busy,
  error,
  capturedImage,
  onClose,
  onCapture,
  onRetake
}: {
  busy: boolean;
  error: string | null;
  capturedImage: string | null;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  onRetake: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera is not available in this browser');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 960 },
            height: { ideal: 1280 }
          },
          audio: false
        });

        if (cancelled) {
          stopStream(stream);
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (caughtError) {
        if (!cancelled) {
          setCameraError(caughtError instanceof Error ? caughtError.message : 'Unable to open camera');
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        stopStream(streamRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!busy) {
      setScanStep(0);
      return;
    }

    const timer = window.setInterval(() => {
      setScanStep((current) => Math.min(current + 1, ppeScanSteps.length - 1));
    }, 900);

    return () => window.clearInterval(timer);
  }, [busy]);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Camera is still loading. Try again in a second.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');

    if (!context) {
      setCameraError('Unable to capture camera frame.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL('image/jpeg', 0.78));
  };

  if (capturedImage) {
    return (
      <div className="absolute inset-0 z-50 grid place-items-center bg-[#FFFDFB]/82 px-5 backdrop-blur-sm">
        <div className="w-full max-w-[340px] rounded-[1.5rem] border border-[#F3D7C8] bg-white p-4 text-[#2F2C2A] shadow-[0_24px_70px_rgba(76,48,35,0.22)]">
          <img
            src={capturedImage}
            alt="Captured PPE verification frame"
            className="max-h-[360px] w-full rounded-2xl object-cover"
          />
          <div className="mt-4 rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
            <div className="flex items-center gap-3">
              {busy ? (
                <span className="h-7 w-7 shrink-0 rounded-full border-2 border-[#F3D7C8] border-t-[#FD7124] animate-spin" />
              ) : (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FD7124] text-white">
                  <Camera size={14} />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#2F2C2A]">{busy ? ppeScanSteps[scanStep] : 'Captured image ready'}</p>
                <p className="mt-1 text-xs text-[#776B63]">{busy ? 'Analyzing helmet and harness' : 'Retake or verify this frame'}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {ppeScanSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      index < scanStep
                        ? 'bg-[#FD7124]'
                        : index === scanStep && busy
                          ? 'bg-[#FD7124] shadow-[0_0_12px_rgba(253,113,36,0.65)] animate-pulse'
                          : 'bg-[#D9C5B9]'
                    }`}
                  />
                  <span className={`text-xs font-medium ${index <= scanStep && busy ? 'text-[#2F2C2A]' : 'text-[#776B63]'}`}>{step}</span>
                  {index === scanStep && busy ? (
                    <span className="ml-auto h-3.5 w-3.5 rounded-full border-2 border-[#F3D7C8] border-t-[#FD7124] animate-spin" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          {cameraError || error ? (
            <p className="mt-3 rounded-md bg-[#FFEFE6] px-3 py-2 text-sm font-semibold text-[#B84011]">{error ?? cameraError}</p>
          ) : null}
          {!busy ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onRetake}
                className="inline-flex h-11 items-center justify-center rounded-md border border-[#F3D7C8] bg-white text-sm font-bold text-[#3D3835] transition hover:bg-[#FFF8F4]"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => onCapture(capturedImage)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#FD7124] text-sm font-bold text-white transition hover:bg-[#E85F18]"
              >
                <Camera size={16} />
                Verify
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#111111] text-white">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-14">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-white/55">PPE Check</p>
          <p className="mt-1 text-xl font-bold">Helmet + harness verification</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50"
          aria-label="Close PPE camera"
          title="Close"
        >
          x
        </button>
      </div>

      <div className="relative mx-5 min-h-0 flex-1 overflow-hidden rounded-[1.5rem] bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-4 rounded-[1.25rem] border-2 border-white/50" />
        <div className="pointer-events-none absolute left-1/2 top-8 w-[68%] -translate-x-1/2 rounded-full border border-white/35 px-3 py-2 text-center text-xs font-bold text-white/85">
          Face camera. Show helmet and harness straps.
        </div>
        {busy && !capturedImage ? (
          <div className="absolute inset-0 grid place-items-center bg-black/45 px-6 backdrop-blur-[1px]">
            <div className="w-full rounded-2xl border border-white/20 bg-[#111111]/80 p-4 text-white shadow-[0_18px_52px_rgba(0,0,0,0.35)]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#FD7124]">
                  <Camera size={18} className="animate-pulse" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{ppeScanSteps[scanStep]}</p>
                  <p className="mt-1 text-xs text-white/65">Analyzing captured PPE image</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {ppeScanSteps.map((step, index) => (
                  <span
                    key={step}
                    className={`h-1.5 rounded-full transition ${
                      index <= scanStep ? 'bg-[#FD7124] shadow-[0_0_12px_rgba(253,113,36,0.75)]' : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full w-1/2 rounded-full bg-white/80 shadow-[0_0_16px_rgba(255,255,255,0.75)] animate-pulse" />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="space-y-3 px-5 pb-5 pt-4">
        {cameraError || error ? (
          <p className="rounded-md bg-[#FFEFE6] px-3 py-2 text-sm font-semibold text-[#B84011]">{error ?? cameraError}</p>
        ) : null}
        <button
          type="button"
          onClick={captureFrame}
          disabled={busy || Boolean(cameraError)}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#FD7124] text-sm font-bold text-white transition hover:bg-[#E85F18] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Camera size={18} />
          Capture & Verify
        </button>
      </div>
    </div>
  );
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 p-3">
      <p className="text-white/70">{label}</p>
      <p className="mt-1 truncate font-semibold">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-[#FFF8F4] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-[#A09188]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold capitalize text-[#2F2C2A]">{value}</p>
    </div>
  );
}

function LoadingState() {
  return <p className="rounded-md bg-[#FFF8F4] px-3 py-4 text-sm text-[#776B63]">Loading worker app...</p>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-md bg-[#FFF8F4] px-3 py-4 text-sm text-[#776B63]">{text}</p>;
}

function formatTime(value?: string) {
  if (!value) {
    return 'scheduled time';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function vibrateSos() {
  const navigatorWithVibration = navigator as Navigator & {
    vibrate?: (pattern: number | number[]) => boolean;
  };

  navigatorWithVibration.vibrate?.([180, 80, 180, 80, 360]);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
