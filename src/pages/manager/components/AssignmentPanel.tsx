import { Check, ChevronRight, Loader2, MapPin, Search, Sparkles, TimerReset, UserCheck, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Pill } from '../../../components/ui/Pill';
import { toneStyles } from '../../../constants/workforce';
import type { Task, Worker } from '../../../types/workforce';

type AssignmentPanelProps = {
  selectedWorker: Worker;
  workers: Worker[];
  task: Task | null;
  assigning: boolean;
  error: string | null;
  success: string | null;
  onSelectWorker: (worker: Worker) => void;
  onApprove: (workerId?: string) => void;
};

export type AssignmentCandidate = {
  worker: Worker;
  score: number;
  rank: number;
  recommended: boolean;
  explanation: string;
};

const scanSteps = ['Task constraints', 'Availability', 'Fatigue load', 'Crew ranking'];

export function AssignmentPanel({
  selectedWorker,
  workers,
  task,
  assigning,
  error,
  success,
  onSelectWorker,
  onApprove
}: AssignmentPanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [scanReady, setScanReady] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [rankedCandidates, setRankedCandidates] = useState<AssignmentCandidate[]>([]);
  const candidates = useMemo(() => buildAssignmentCandidates(task, workers), [task, workers]);
  const visibleCandidates = modalOpen ? rankedCandidates : candidates;
  const selectedCandidate = visibleCandidates.find((candidate) => candidate.worker.id === selectedWorker.id) ?? visibleCandidates[0] ?? null;
  const topCandidate = candidates[0] ?? null;

  useEffect(() => {
    if (!modalOpen) {
      setScanReady(false);
      setScanStep(0);
      return;
    }

    setScanReady(false);
    setScanStep(0);
    const stepTimer = window.setInterval(() => {
      setScanStep((step) => Math.min(scanSteps.length - 1, step + 1));
    }, 430);
    const readyTimer = window.setTimeout(() => {
      setScanReady(true);
      window.clearInterval(stepTimer);
      setScanStep(scanSteps.length - 1);
    }, 1750);

    return () => {
      window.clearInterval(stepTimer);
      window.clearTimeout(readyTimer);
    };
  }, [modalOpen]);

  useEffect(() => {
    if (success && !assigning) {
      setModalOpen(false);
    }
  }, [assigning, success]);

  const openAssignmentModal = () => {
    if (!task || !topCandidate) {
      return;
    }

    onSelectWorker(topCandidate.worker);
    setRankedCandidates(candidates);
    setModalOpen(true);
  };

  const confirmAssignment = () => {
    if (!selectedCandidate) {
      return;
    }

    onApprove(selectedCandidate.worker.id);
  };

  return (
    <section className="rounded-2xl border border-[#F3D7C8] bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#2F2C2A]">Recommended Assignment</p>
          <p className="mt-1 text-sm text-[#776B63]">
            {task ? `${task.taskTemplate} / ${task.zone}` : 'No open task is waiting for assignment.'}
          </p>
        </div>
        <Button variant="primary" onClick={openAssignmentModal} disabled={!task || assigning || !topCandidate}>
          <Search size={16} />
          {task ? 'Assign' : 'No Task'}
        </Button>
      </div>

      {error ? <p className="mt-4 rounded-xl bg-[#FFEFE6] px-3 py-2 text-sm font-semibold text-[#B84011]">{error}</p> : null}
      {success ? <p className="mt-4 rounded-xl bg-[#EAF5ED] px-3 py-2 text-sm font-semibold text-[#3F7A54]">{success}</p> : null}

      {task ? (
        <div className="mt-5 rounded-2xl border border-[#F3D7C8] bg-[#FFFDFB] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFEFE6] text-[#FD7124]">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#2F2C2A]">Scheduler recommendation ready</p>
                <p className="mt-1 truncate text-xs text-[#776B63]">
                  {topCandidate ? `${topCandidate.worker.name} leads with ${topCandidate.score}% match.` : 'Worker Assignment Engine ranks the crew before manager approval.'}
                </p>
              </div>
            </div>
            <Pill className="bg-[#FFF7ED] text-[#9A5719]">{task.schedulerRecommendation.chronosForecast.modelStatus ?? 'UNAVAILABLE'}</Pill>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Best fit" value={topCandidate?.worker.name ?? 'No worker'} />
            <MiniMetric label="Candidates" value={`${candidates.length} ranked`} />
            <MiniMetric label="Crew need" value={String(task.schedulerRecommendation.recommendedCrewSize)} />
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <button
          type="button"
          onClick={() => onSelectWorker(selectedWorker)}
          className="flex min-h-[96px] items-center gap-4 rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4 text-left transition hover:border-[#FD7124]/60 hover:shadow-[0_14px_34px_rgba(253,113,36,0.12)]"
        >
          <WorkerAvatar worker={selectedWorker} />
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-[#2F2C2A]">{selectedWorker.name}</span>
            <span className="mt-1 block text-sm text-[#776B63]">{selectedWorker.role} · {selectedWorker.zone}</span>
            <span className="mt-3 block h-2 rounded-full bg-[#F5D8C8]">
              <span className="block h-2 rounded-full bg-[#FD7124]" style={{ width: `${selectedWorker.match}%` }} />
            </span>
          </span>
          <span className="text-right">
            <span className="block text-2xl font-semibold text-[#2F2C2A]">{selectedWorker.match}%</span>
            <span className="text-xs font-medium text-[#776B63]">profile</span>
          </span>
        </button>

        <TaskSummary task={task} />
      </div>

      {modalOpen && task ? (
        <AssignmentRankingModal
          task={task}
          assigning={assigning}
          candidates={rankedCandidates}
          scanReady={scanReady}
          scanStep={scanStep}
          selectedWorkerId={selectedCandidate?.worker.id ?? null}
          onSelectWorker={onSelectWorker}
          onClose={() => setModalOpen(false)}
          onConfirm={confirmAssignment}
        />
      ) : null}
    </section>
  );
}

export function AssignmentRankingModal({
  task,
  candidates,
  assigning,
  scanReady,
  scanStep,
  selectedWorkerId,
  onSelectWorker,
  onClose,
  onConfirm
}: {
  task: Task;
  candidates: AssignmentCandidate[];
  assigning: boolean;
  scanReady: boolean;
  scanStep: number;
  selectedWorkerId: string | null;
  onSelectWorker: (worker: Worker) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const selectedCandidate = candidates.find((candidate) => candidate.worker.id === selectedWorkerId) ?? candidates[0] ?? null;
  const submitting = assigning || localSubmitting;

  useEffect(() => {
    if (!assigning) {
      setLocalSubmitting(false);
    }
  }, [assigning]);

  const submitAssignment = () => {
    if (!selectedCandidate || localSubmitting) {
      return;
    }

    setLocalSubmitting(true);
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#2F2C2A]/35 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#F3D7C8] bg-[#FFFEFC] shadow-[0_24px_80px_rgba(47,44,42,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#F3D7C8] p-5 sm:p-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#C95119]">
              <Sparkles size={17} />
              Assignment Ranking
            </p>
            <h3 className="mt-2 truncate text-2xl font-semibold tracking-normal text-[#2F2C2A]">{task.taskTemplate}</h3>
            <p className="mt-2 text-sm text-[#776B63]">{task.project} / {task.zone} / {task.quantity} {task.unit}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#F3D7C8] bg-white text-[#776B63] transition hover:bg-[#FFEFE6] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close assignment ranking"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-88px)] space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#2F2C2A]">{scanReady ? 'Ranking ready' : 'Finding best fit'}</p>
                  <p className="mt-1 text-xs leading-5 text-[#776B63]">
                    {scanReady ? 'Choose the worker before assigning.' : 'Comparing crew signals against task needs.'}
                  </p>
                </div>
                {scanReady ? <Check size={19} className="text-[#55936A]" /> : <Loader2 size={20} className="animate-spin text-[#FD7124]" />}
              </div>
              <div className="flex items-center gap-2">
                <Pill className="bg-[#FFF4DC] text-[#8A4B02]">{task.intensity} intensity</Pill>
                <Pill className={toneStyles[task.tone]}>{task.priority}</Pill>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {scanSteps.map((step, index) => {
                const active = !scanReady && scanStep === index;
                const done = scanReady || index <= scanStep;

                return (
                  <div key={step} className="rounded-xl bg-white px-3 py-3">
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                      <span className={`font-semibold ${done ? 'text-[#2F2C2A]' : 'text-[#A09188]'}`}>{step}</span>
                      <span className={`h-2 w-2 rounded-full ${active ? 'bg-[#FD7124] shadow-[0_0_14px_rgba(253,113,36,0.75)]' : done ? 'bg-[#55936A]' : 'bg-[#F3D7C8]'}`} />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#FFF8F4]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-[#FD7124]' : 'bg-[#F3D7C8]'}`}
                        style={{ width: done ? '100%' : '18%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-[#F3D7C8] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#A09188]">Selected</p>
              <p className="mt-2 text-lg font-semibold text-[#2F2C2A]">{selectedCandidate?.worker.name ?? 'No worker'}</p>
              <p className="mt-1 text-sm text-[#776B63]">{selectedCandidate ? `${selectedCandidate.score}% match / rank #${selectedCandidate.rank}` : 'Choose one worker'}</p>
            </div>
            <Button className="w-full sm:w-auto" variant="primary" onClick={submitAssignment} disabled={!scanReady || submitting || !selectedCandidate}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
              {submitting ? 'Assigning...' : 'Assign selected'}
            </Button>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#2F2C2A]">Worker ranking</p>
                <p className="mt-1 text-sm text-[#776B63]">Best fit appears first, but manager controls the final choice.</p>
              </div>
            </div>

            <div className={`space-y-3 transition ${scanReady ? 'opacity-100' : 'opacity-55'}`}>
              {candidates.map((candidate) => (
                <button
                  key={candidate.worker.id}
                  type="button"
                  onClick={() => scanReady && onSelectWorker(candidate.worker)}
                  disabled={!scanReady || submitting}
                  className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                    candidate.worker.id === selectedWorkerId
                      ? 'border-[#FD7124] bg-[#FFF4EC] shadow-[0_16px_34px_rgba(253,113,36,0.14)]'
                      : 'border-[#F3D7C8] bg-white hover:border-[#FD7124]/60'
                  } disabled:cursor-wait`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFF8F4] text-sm font-bold text-[#C95119]">#{candidate.rank}</span>
                  <WorkerAvatar worker={candidate.worker} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[#2F2C2A]">{candidate.worker.name}</span>
                      {candidate.recommended ? <span className="rounded-full bg-[#EAF5ED] px-2 py-0.5 text-[10px] font-bold uppercase text-[#3F7A54]">Engine pick</span> : null}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#776B63]">
                      <span className="inline-flex items-center gap-1"><Users size={13} />{candidate.worker.status}</span>
                      <span className="inline-flex items-center gap-1"><MapPin size={13} />{candidate.worker.zone}</span>
                      <span className="inline-flex items-center gap-1"><TimerReset size={13} />{candidate.worker.fatigue}% fatigue</span>
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-[#776B63]">{candidate.explanation}</span>
                  </span>
                  <span className="w-20 shrink-0 text-right">
                    <span className="block text-2xl font-semibold text-[#2F2C2A]">{candidate.score}%</span>
                    <span className="text-[11px] font-semibold uppercase text-[#A09188]">fit</span>
                  </span>
                  <ChevronRight size={18} className="hidden shrink-0 text-[#FD7124] sm:block" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskSummary({ task }: { task: Task | null }) {
  return (
    <div className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
      {task ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#2F2C2A]">{task.title}</p>
              <p className="mt-1 text-xs text-[#776B63]">{task.project} / {task.quantity} {task.unit}</p>
            </div>
            <Pill className={toneStyles[task.tone]}>{task.priority}</Pill>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniMetric label="Crew" value={String(task.schedulerRecommendation.recommendedCrewSize)} />
            <MiniMetric label="Duration" value={task.schedulerRecommendation.estimatedDuration} />
            <MiniMetric label="Status" value={task.status} />
            <MiniMetric label="Owner" value={task.owner} />
          </div>
        </>
      ) : (
        <p className="text-sm font-semibold text-[#776B63]">Create an open task to get a recommendation.</p>
      )}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-[#A09188]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#2F2C2A]">{value}</p>
    </div>
  );
}

function WorkerAvatar({ worker }: { worker: Worker }) {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#FD7124] text-sm font-bold text-white">
      {worker.name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .slice(0, 2)}
    </span>
  );
}

export function buildAssignmentCandidates(task: Task | null, workers: Worker[]): AssignmentCandidate[] {
  if (!task) {
    return [];
  }

  const recommendationByWorker = new Map(
    task.schedulerRecommendation.selectedWorkerRecommendations.map((recommendation, index) => [recommendation.workerId, { ...recommendation, index }])
  );

  return workers
    .map((worker) => {
      const recommendation = recommendationByWorker.get(worker.id);
      const sameZone = worker.zone === task.zone;
      const statusScore = worker.status === 'waiting'
        ? 10
        : worker.status === 'working'
          ? -6
          : worker.status === 'break'
            ? -18
            : worker.status === 'emergency'
              ? -40
              : -8;
      const recommendationScore = recommendation ? 98 - recommendation.index * 7 : worker.match - 14;
      const fatigueThreshold = task.intensity === 'High' ? 25 : task.intensity === 'Low' ? 60 : 45;
      const fatigueMultiplier = task.intensity === 'High' ? 0.55 : task.intensity === 'Low' ? 0.2 : 0.35;
      const fatiguePenalty = Math.max(0, worker.fatigue - fatigueThreshold) * fatigueMultiplier;
      const score = clampScore(Math.round(recommendationScore + statusScore + (sameZone ? 8 : 0) - fatiguePenalty));

      return {
        worker,
        score,
        rank: 0,
        recommended: Boolean(recommendation),
        explanation: recommendation?.explanation ?? explainWorkerFit(worker, task, sameZone)
      };
    })
    .sort((left, right) => right.score - left.score)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

function explainWorkerFit(worker: Worker, task: Task, sameZone: boolean) {
  const zone = sameZone ? 'same zone' : `currently in ${worker.zone}`;
  const status = worker.status === 'waiting' ? 'available now' : `${worker.status} status`;
  return `${worker.role} is ${status}, ${zone}, with ${worker.fatigue}% fatigue for ${task.intensity.toLowerCase()} intensity and ${task.workload} workload.`;
}

function clampScore(value: number) {
  return Math.max(18, Math.min(99, value));
}
