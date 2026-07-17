import { CalendarClock, CheckCircle2, ClipboardCheck, ClipboardList, Clock, ImageIcon, InfoIcon, UserCheck, X, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Pill } from '../../../components/ui/Pill';
import { toneStyles } from '../../../constants/workforce';
import type { Task, Worker } from '../../../types/workforce';
import { AssignmentRankingModal, buildAssignmentCandidates } from '../components/AssignmentPanel';
import { MetricCard } from '../components/MetricCard';
import { TaskPanel } from '../components/TaskPanel';

export function TasksView({
  tasks,
  workers,
  onAutoAssign,
  onReviewCompletion
}: {
  tasks: Task[];
  workers: Worker[];
  onAutoAssign: (taskId: string, workerId?: string) => Promise<Task>;
  onReviewCompletion: (taskId: string, decision: 'accept' | 'reject', note?: string) => Promise<Task>;
}) {
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const readyReviewCount = tasks.filter((task) => task.status.toLowerCase().includes('review')).length;
  const safetyOpenCount = tasks.filter((task) => ['high', 'critical'].includes(task.priority.toLowerCase())).length;
  const assignedCount = tasks.filter((task) => task.owner !== 'Unassigned').length;
  const assignedPct = tasks.length ? Math.round((assignedCount / tasks.length) * 100) : 0;
  const sortedTasks = tasks
    .slice()
    .sort((left, right) => getTaskUrgencyScore(right, now) - getTaskUrgencyScore(left, now));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const assignTask = async (taskId: string, workerId?: string) => {
    setAssigningTaskId(taskId);
    setAssignmentError(null);

    try {
      await onAutoAssign(taskId, workerId);
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'Unable to assign task');
      throw error;
    } finally {
      setAssigningTaskId(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-8">
        <section className="overflow-hidden rounded-2xl border border-[#F3D7C8] bg-white">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-6 sm:p-7">
              <p className="text-sm font-semibold text-[#C95119]">Tasks</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal text-[#2F2C2A]">Plan the work, then open details only when needed.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#776B63]">The timeline stays light; each task keeps deeper scheduler information inside its popup.</p>
            </div>
            <div className="border-t border-[#F3D7C8] bg-[#FFF8F4] p-6 lg:border-l lg:border-t-0">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Total" value={String(tasks.length)} detail="Active tasks" icon={ClipboardList} />
                <MetricCard label="Review" value={String(readyReviewCount)} detail="Waiting proof" icon={ClipboardCheck} />
              </div>
              <div className="mt-4 rounded-2xl bg-white p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#2F2C2A]">Assigned</span>
                  <span className="text-[#776B63]">{assignedPct}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[#F5D8C8]">
                  <div className="h-2 rounded-full bg-[#FD7124]" style={{ width: `${assignedPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#F3D7C8] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#2F2C2A]">Task Timeline</p>
              <p className="mt-1 text-sm text-[#776B63]">Operational tasks grouped by priority and ownership.</p>
            </div>
            <div className="flex items-center gap-2">
              {safetyOpenCount ? <Pill className="bg-[#FFEFE6] text-[#B84011]">{safetyOpenCount} high priority</Pill> : null}
              <Clock size={18} className="text-[#FAA745]" />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {assignmentError ? <p className="rounded-xl bg-[#FFEFE6] px-3 py-2 text-sm font-semibold text-[#B84011]">{assignmentError}</p> : null}
            {sortedTasks.map((task, index) => (
              <div key={task.id} className={`rounded-2xl border p-5 transition hover:border-[#FD7124]/55 ${getTimelineCardClass(index)}`}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_120px_150px_110px_44px] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      {index < 3 ? <span className={getRankBadgeClass(index)}>#{index + 1}</span> : null}
                      <p className="truncate text-sm font-semibold text-[#2F2C2A]">{task.taskTemplate}</p>
                    </div>
                    <p className="mt-1 text-sm text-[#776B63]">{task.project} / {task.owner}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-[#A09188]">Zone</p>
                    <p className="mt-1 text-sm font-semibold text-[#5F5A56]">{task.zone}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill className={toneStyles[task.tone]}>{task.priority || task.status}</Pill>
                    <Pill className="bg-[#FFF1E8] text-[#C95119]">{task.schedulerRecommendation.predictedWorkload ?? task.workload ?? 'No workload'}</Pill>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#5F5A56]">
                    <CalendarClock size={16} className="text-[#FAA745]" />
                    <span>{formatDueCountdown(task, now)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#F3D7C8] bg-white text-[#C95119] transition hover:bg-[#FFEFE6]"
                    aria-label={`Open details for ${task.taskTemplate}`}
                  >
                    <InfoIcon size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <TaskPanel tasks={tasks} />
      {selectedTask ? (
        <TaskDetailModal
          task={selectedTask}
          workers={workers}
          assigning={assigningTaskId === selectedTask.id}
          onAssign={(workerId) => assignTask(selectedTask.id, workerId)}
          onReviewCompletion={(decision, note) => onReviewCompletion(selectedTask.id, decision, note)}
          onClose={() => setSelectedTaskId(null)}
        />
      ) : null}
    </div>
  );
}

function TaskDetailModal({
  task,
  workers,
  assigning,
  onAssign,
  onReviewCompletion,
  onClose
}: {
  task: Task;
  workers: Worker[];
  assigning: boolean;
  onAssign: (workerId?: string) => Promise<void>;
  onReviewCompletion: (decision: 'accept' | 'reject', note?: string) => Promise<Task>;
  onClose: () => void;
}) {
  const [reviewing, setReviewing] = useState<'accept' | 'reject' | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [assignmentRankingOpen, setAssignmentRankingOpen] = useState(false);
  const [assignmentScanReady, setAssignmentScanReady] = useState(false);
  const [assignmentScanStep, setAssignmentScanStep] = useState(0);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [rankedCandidates, setRankedCandidates] = useState<ReturnType<typeof buildAssignmentCandidates>>([]);
  const liveCandidates = useMemo(() => buildAssignmentCandidates(task, workers), [task, workers]);
  const canAssign = task.owner === 'Unassigned' && liveCandidates.length > 0;
  const hasProof = Boolean(task.completionProofImage);
  const canReviewProof = task.status.toLowerCase().includes('review') && hasProof && task.completionProofStatus !== 'ACCEPTED';

  useEffect(() => {
    setAssignmentRankingOpen(false);
    setAssignmentScanReady(false);
    setAssignmentScanStep(0);
  }, [task.id]);

  useEffect(() => {
    if (!assignmentRankingOpen) {
      setAssignmentScanReady(false);
      setAssignmentScanStep(0);
      return;
    }

    setAssignmentScanReady(false);
    setAssignmentScanStep(0);
    const stepTimer = window.setInterval(() => {
      setAssignmentScanStep((step) => Math.min(3, step + 1));
    }, 430);
    const readyTimer = window.setTimeout(() => {
      setAssignmentScanReady(true);
      window.clearInterval(stepTimer);
      setAssignmentScanStep(3);
    }, 1750);

    return () => {
      window.clearInterval(stepTimer);
      window.clearTimeout(readyTimer);
    };
  }, [assignmentRankingOpen, task.id]);

  const openAssignmentRanking = () => {
    setRankedCandidates(liveCandidates);
    setSelectedWorkerId(liveCandidates[0]?.worker.id ?? '');
    setAssignmentRankingOpen(true);
  };

  const confirmAssignment = async () => {
    const workerId = selectedWorkerId || rankedCandidates[0]?.worker.id;

    try {
      await onAssign(workerId);
      setAssignmentRankingOpen(false);
    } catch {
      // The parent already exposes the request error in the task page.
    }
  };

  if (assignmentRankingOpen) {
    return (
      <AssignmentRankingModal
        task={task}
        candidates={rankedCandidates}
        assigning={assigning}
        scanReady={assignmentScanReady}
        scanStep={assignmentScanStep}
        selectedWorkerId={selectedWorkerId || rankedCandidates[0]?.worker.id || null}
        onSelectWorker={(worker) => setSelectedWorkerId(worker.id)}
        onClose={() => setAssignmentRankingOpen(false)}
        onConfirm={() => void confirmAssignment()}
      />
    );
  }

  const submitReview = async (decision: 'accept' | 'reject') => {
    setReviewing(decision);
    setReviewError(null);

    try {
      await onReviewCompletion(decision, decision === 'reject' ? rejectNote : undefined);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Unable to review task');
    } finally {
      setReviewing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292622]/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(41,38,34,0.2)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#F3D7C8] px-5 py-4">
          <div className="min-w-0">
            <p id="task-detail-title" className="truncate text-base font-semibold text-[#2F2C2A]">{task.taskTemplate}</p>
            <p className="mt-1 text-sm text-[#776B63]">{task.project} / {task.owner}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#F3D7C8] bg-white text-[#776B63] transition hover:bg-[#FFEFE6] hover:text-[#2F2C2A]"
            aria-label="Close task details"
          >
            <X size={17} />
          </button>
        </div>

        <div className="max-h-[calc(88vh-76px)] overflow-y-auto px-5 py-5">
          <div className="grid gap-3 md:grid-cols-4">
            <Info label="Quantity" value={`${task.quantity} ${task.unit}`} />
            <Info label="Location" value={task.location || task.zone} />
            <Info label="Predicted workload" value={task.schedulerRecommendation.predictedWorkload ?? task.workload ?? '-'} />
            <Info label="Worker-hours" value={String(task.schedulerRecommendation.totalWorkerHours)} />
            <Info label="Crew size" value={String(task.schedulerRecommendation.recommendedCrewSize)} />
            <Info label="Duration" value={task.schedulerRecommendation.estimatedDuration} />
            <Info label="Feasibility" value={task.schedulerRecommendation.deadlineFeasibilityStatus} />
            <Info label="Rest automation" value="IoT Fatigue Engine" />
          </div>

          <div className="mt-4 rounded-xl bg-[#FFF8F4] p-4">
            <p className="text-xs font-semibold uppercase text-[#A09188]">Scheduler Engines</p>
            <p className="mt-2 text-sm leading-6 text-[#776B63]">
              Start {task.schedulerRecommendation.recommendedStartTime}; finish {formatFinishTime(task.schedulerRecommendation.estimatedFinishTime)}; productivity {task.schedulerRecommendation.expectedProductivityRate}.
            </p>
            <p className="mt-2 text-xs leading-5 text-[#776B63]">{task.schedulerRecommendation.currentEnvironmentalConditions}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Info label="Chronos productivity" value={task.schedulerRecommendation.chronosForecast.futureProductivity} />
              <Info label="Delay prediction" value={task.schedulerRecommendation.chronosForecast.delayPrediction} />
              <Info label="Add crew" value={String(task.schedulerRecommendation.chronosForecast.suggestedAdditionalCrew)} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Info label="Required PPE and certifications" value={task.schedulerRecommendation.requiredPpeAndCertifications.join(', ') || 'No extra PPE'} />
            <Info label="Dependency status" value={task.schedulerRecommendation.dependencyStatus} />
          </div>

          {hasProof ? (
            <div className="mt-4 rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#2F2C2A]">
                    <ImageIcon size={16} className="text-[#FD7124]" />
                    Completion Proof
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#776B63]">
                    Submitted {task.completionProofSubmittedAt ? formatFinishTime(task.completionProofSubmittedAt) : 'recently'} by {task.owner}.
                  </p>
                </div>
                <Pill className={task.completionProofStatus === 'REJECTED' ? 'bg-[#FFEFE6] text-[#B84011]' : 'bg-[#FFF7ED] text-[#9A5719]'}>
                  {task.completionProofStatus ?? 'PENDING'}
                </Pill>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                <img
                  src={task.completionProofImage}
                  alt={`Completion proof for ${task.taskTemplate}`}
                  className="h-56 w-full rounded-xl border border-[#F3D7C8] object-cover"
                />
                <div className="flex min-h-56 flex-col rounded-xl border border-[#F3D7C8] bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-[#A09188]">Manager review</p>
                  <p className="mt-2 text-sm leading-6 text-[#776B63]">
                    Accept if the photo clearly matches the assigned work and location. Reject if the worker needs to submit a better proof.
                  </p>
                  {task.completionProofNote ? (
                    <p className="mt-3 rounded-xl bg-[#FFF8F4] px-3 py-2 text-xs font-semibold text-[#776B63]">{task.completionProofNote}</p>
                  ) : null}
                  {canReviewProof ? (
                    <>
                      <textarea
                        value={rejectNote}
                        onChange={(event) => setRejectNote(event.target.value)}
                        className="mt-3 min-h-20 rounded-xl border border-[#F3D7C8] bg-[#FFFDFB] px-3 py-2 text-sm text-[#2F2C2A] outline-none transition placeholder:text-[#A09188] focus:border-[#FD7124] focus:ring-2 focus:ring-[#FFEFE6]"
                        placeholder="Optional rejection note"
                      />
                      {reviewError ? <p className="mt-3 rounded-xl bg-[#FFEFE6] px-3 py-2 text-xs font-semibold text-[#B84011]">{reviewError}</p> : null}
                      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
                        <button
                          type="button"
                          onClick={() => submitReview('reject')}
                          disabled={Boolean(reviewing)}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#F3D7C8] bg-white text-sm font-semibold text-[#B84011] transition hover:bg-[#FFEFE6] disabled:opacity-60"
                        >
                          <XCircle size={16} />
                          {reviewing === 'reject' ? 'Rejecting...' : 'Reject'}
                        </button>
                        <button
                          type="button"
                          onClick={() => submitReview('accept')}
                          disabled={Boolean(reviewing)}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#FD7124] text-sm font-semibold text-white transition hover:bg-[#E85F18] disabled:opacity-60"
                        >
                          <CheckCircle2 size={16} />
                          {reviewing === 'accept' ? 'Accepting...' : 'Accept'}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ) : task.status.toLowerCase().includes('review') ? (
            <div className="mt-4 rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
              <p className="text-sm font-semibold text-[#2F2C2A]">Completion proof missing</p>
              <p className="mt-1 text-xs leading-5 text-[#776B63]">Worker must submit a direct photo or upload before manager review.</p>
            </div>
          ) : null}

          {task.schedulerRecommendation.safetyAndOperationalWarnings.length > 0 ? (
            <div className="mt-4 rounded-xl border border-[#F3D7C8] bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase text-[#A09188]">Safety and operational warnings</p>
              <div className="mt-2 space-y-1">
                {task.schedulerRecommendation.safetyAndOperationalWarnings.map((warning) => (
                  <p key={warning} className="text-xs leading-5 text-[#776B63]">{warning}</p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 border-t border-[#F3D7C8] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs leading-5 text-[#776B63]">
                {task.owner === 'Unassigned' ? 'Review the ranked recommendations before assigning.' : `Assigned to ${task.owner}.`}
              </p>
              <p className="mt-2 text-xs font-semibold text-[#776B63]">
                Model status: {task.schedulerRecommendation.chronosForecast.modelStatus === 'UNAVAILABLE' ? 'Failed' : 'Ready'} / Forecast confidence: {task.schedulerRecommendation.chronosForecast.confidence ?? 'INFERRED'}
              </p>
              <p className="mt-2 text-xs font-semibold text-[#C95119]">{task.schedulerRecommendation.schedulerStatus}</p>
            </div>
            {task.owner === 'Unassigned' ? (
              <button
                type="button"
                onClick={openAssignmentRanking}
                disabled={assigning || !canAssign}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FD7124] px-3 text-xs font-semibold text-white transition hover:bg-[#E85F18] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserCheck size={15} />
                Assign
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#FFF8F4] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-[#A09188]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#2F2C2A]">{value}</p>
    </div>
  );
}

function formatFinishTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatDueCountdown(task: Task, now: Date) {
  const deadline = parseDeadline(task.deadline);

  if (!deadline) {
    const legacyDuration = normalizeLegacyDuration(task.deadline || task.due);

    if (legacyDuration) {
      return `Due in ${legacyDuration}`;
    }

    return task.status.toLowerCase().includes('review') ? 'Ready for review' : 'No deadline';
  }

  const diffMs = deadline.getTime() - now.getTime();
  const duration = formatRelativeDuration(Math.abs(diffMs));

  if (Math.abs(diffMs) < 60_000) {
    return 'Due now';
  }

  return diffMs > 0 ? `Due in ${duration}` : `Overdue by ${duration}`;
}

function getTaskUrgencyScore(task: Task, now: Date) {
  const priorityScore: Record<string, number> = {
    critical: 400,
    high: 300,
    medium: 180,
    low: 80
  };
  const status = task.status.toLowerCase();
  const statusScore = status.includes('review')
    ? 40
    : status.includes('progress')
      ? 120
      : task.owner === 'Unassigned'
        ? 150
        : 90;
  const toneScore = task.tone === 'danger' ? 120 : task.tone === 'warning' ? 80 : task.tone === 'success' ? 20 : 40;
  const deadline = parseDeadline(task.deadline);
  let deadlineScore = 0;

  if (deadline) {
    const hoursLeft = (deadline.getTime() - now.getTime()) / 3_600_000;

    if (hoursLeft < 0) deadlineScore = 220;
    else if (hoursLeft <= 2) deadlineScore = 180;
    else if (hoursLeft <= 8) deadlineScore = 120;
    else if (hoursLeft <= 24) deadlineScore = 70;
  } else if (task.deadline.toLowerCase().includes('30m')) {
    deadlineScore = 170;
  } else if (task.deadline.toLowerCase().includes('45m')) {
    deadlineScore = 130;
  }

  return (priorityScore[task.priority.toLowerCase()] ?? 60) + statusScore + toneScore + deadlineScore;
}

function getTimelineCardClass(index: number) {
  if (index === 0) {
    return 'border-[#FD7124]/70 bg-[#FFF1E8] shadow-[0_14px_38px_rgba(253,113,36,0.12)] hover:bg-[#FFEFE6]';
  }

  if (index === 1) {
    return 'border-[#FAA745]/70 bg-[#FFF7E8] shadow-[0_12px_32px_rgba(250,167,69,0.1)] hover:bg-[#FFF4DC]';
  }

  if (index === 2) {
    return 'border-[#F3D7C8] bg-[#FFF8F4] hover:bg-[#FFEFE6]';
  }

  return 'border-[#F3D7C8] bg-white hover:bg-[#FFF8F4]';
}

function getRankBadgeClass(index: number) {
  if (index === 0) {
    return 'shrink-0 rounded-lg bg-[#FD7124] px-2 py-1 text-[11px] font-bold text-white';
  }

  if (index === 1) {
    return 'shrink-0 rounded-lg bg-[#FAA745] px-2 py-1 text-[11px] font-bold text-[#2F2C2A]';
  }

  return 'shrink-0 rounded-lg bg-[#FFEFE6] px-2 py-1 text-[11px] font-bold text-[#B84011]';
}

function parseDeadline(value: string) {
  if (!value || normalizeLegacyDuration(value)) {
    return null;
  }

  const deadline = new Date(value);
  return Number.isNaN(deadline.getTime()) ? null : deadline;
}

function normalizeLegacyDuration(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const durationPattern = /^((\d+)\s*d)?\s*((\d+)\s*h)?\s*((\d+)\s*m)?$/i;
  const match = trimmed.match(durationPattern);

  if (!match || !/[dhm]/i.test(trimmed)) {
    return null;
  }

  return trimmed.replace(/\s+/g, ' ');
}

function formatRelativeDuration(milliseconds: number) {
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days) {
    parts.push(`${days}d`);
  }

  if (hours) {
    parts.push(`${hours}h`);
  }

  if (!days && minutes) {
    parts.push(`${minutes}m`);
  }

  return parts.join(' ') || '1m';
}
