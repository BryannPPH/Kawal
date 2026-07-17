import { AlertCircle, CalendarRange, Check, LoaderCircle, WandSparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Task, Worker } from '../../../types/workforce';
import { buildAssignmentCandidates } from './AssignmentPanel';

type BulkAutoAssignModalProps = {
  tasks: Task[];
  workers: Worker[];
  onAssign: (taskId: string, workerId: string) => Promise<Task>;
  onClose: () => void;
};

type AssignmentStatus = 'queued' | 'assigning' | 'assigned' | 'failed';

type AssignmentRow = {
  task: Task;
  status: AssignmentStatus;
  worker?: Worker;
  error?: string;
};

export function BulkAutoAssignModal({ tasks, workers, onAssign, onClose }: BulkAutoAssignModalProps) {
  const initialStart = useMemo(() => startOfToday(new Date()), []);
  const initialEnd = useMemo(() => addDays(initialStart, 7), [initialStart]);
  const [startValue, setStartValue] = useState(() => toDateTimeInput(initialStart));
  const [endValue, setEndValue] = useState(() => toDateTimeInput(initialEnd));
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<'select' | 'processing' | 'complete'>('select');
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const startDate = parseInputDate(startValue);
  const endDate = parseInputDate(endValue);
  const rangeValid = Boolean(startDate && endDate && endDate > startDate);
  const eligibleTasks = useMemo(() => {
    if (!startDate || !endDate || endDate <= startDate) return [];

    return tasks
      .filter((task) => {
        if (task.owner !== 'Unassigned') return false;
        const deadline = getTaskDeadline(task);
        return deadline ? deadline >= startDate && deadline <= endDate : false;
      })
      .sort((left, right) => getTaskDeadline(left)!.getTime() - getTaskDeadline(right)!.getTime());
  }, [endDate?.getTime(), startDate?.getTime(), tasks]);
  const eligibleTaskKey = eligibleTasks.map((task) => task.id).join('|');
  const completedCount = rows.filter((row) => row.status === 'assigned' || row.status === 'failed').length;
  const assignedCount = rows.filter((row) => row.status === 'assigned').length;
  const progress = rows.length ? Math.round((completedCount / rows.length) * 100) : 0;

  useEffect(() => {
    setSelectedTaskIds(new Set(eligibleTasks.map((task) => task.id)));
  }, [eligibleTaskKey]);

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const runAssignment = async () => {
    const queue = eligibleTasks
      .filter((task) => selectedTaskIds.has(task.id))
      .sort((left, right) => getBulkTaskScore(right) - getBulkTaskScore(left));

    if (!queue.length) return;

    const assignmentLoad = new Map<string, number>();
    setRows(queue.map((task) => ({ task, status: 'queued' })));
    setPhase('processing');

    for (const task of queue) {
      const candidate = pickWorker(task, workers, assignmentLoad);

      if (!candidate) {
        setRows((current) => updateRow(current, task.id, { status: 'failed', error: 'No eligible worker available' }));
        continue;
      }

      setRows((current) => updateRow(current, task.id, { status: 'assigning', worker: candidate }));
      await delay(420);

      try {
        await onAssign(task.id, candidate.id);
        assignmentLoad.set(candidate.id, (assignmentLoad.get(candidate.id) ?? 0) + 1);
        setRows((current) => updateRow(current, task.id, { status: 'assigned', worker: candidate }));
      } catch (error) {
        setRows((current) => updateRow(current, task.id, {
          status: 'failed',
          worker: candidate,
          error: error instanceof Error ? error.message : 'Assignment failed'
        }));
      }

      await delay(180);
    }

    setPhase('complete');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292622]/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="bulk-assignment-title">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(41,38,34,0.2)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#F3D7C8] px-5 py-4">
          <div className="min-w-0">
            <p id="bulk-assignment-title" className="flex items-center gap-2 text-base font-semibold text-[#2F2C2A]">
              <WandSparkles size={18} className="text-[#FD7124]" />
              Auto Assign Tasks
            </p>
            <p className="mt-1 text-sm text-[#776B63]">
              {phase === 'select' ? 'Choose a time window and task queue.' : phase === 'processing' ? 'Matching workers to the selected work.' : `${assignedCount} of ${rows.length} tasks assigned.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === 'processing'}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#F3D7C8] bg-white text-[#776B63] transition hover:bg-[#FFEFE6] hover:text-[#2F2C2A] disabled:cursor-wait disabled:opacity-40"
            aria-label="Close auto assignment"
          >
            <X size={17} />
          </button>
        </div>

        {phase === 'select' ? (
          <div className="min-h-0 overflow-y-auto px-5 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="flex items-center gap-2 text-xs font-semibold text-[#776B63]"><CalendarRange size={14} className="text-[#FD7124]" />From</span>
                <input type="datetime-local" value={startValue} onChange={(event) => setStartValue(event.target.value)} className="field-input mt-2" />
              </label>
              <label>
                <span className="flex items-center gap-2 text-xs font-semibold text-[#776B63]"><CalendarRange size={14} className="text-[#FD7124]" />Until</span>
                <input type="datetime-local" value={endValue} onChange={(event) => setEndValue(event.target.value)} className="field-input mt-2" />
              </label>
            </div>

            {!rangeValid ? <p className="mt-3 rounded-xl bg-[#FFEFE6] px-3 py-2 text-xs font-semibold text-[#B84011]">End time must be after start time.</p> : null}

            <div className="mt-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#2F2C2A]">Task queue</p>
                <p className="mt-1 text-xs text-[#776B63]">{selectedTaskIds.size} of {eligibleTasks.length} selected</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setSelectedTaskIds(new Set())} className="text-xs font-semibold text-[#776B63] hover:text-[#2F2C2A]">Clear</button>
                <button type="button" onClick={() => setSelectedTaskIds(new Set(eligibleTasks.map((task) => task.id)))} className="text-xs font-semibold text-[#C95119] hover:text-[#FD7124]">Select all</button>
              </div>
            </div>

            <div className="mt-3 divide-y divide-[#F3D7C8] rounded-xl border border-[#F3D7C8]">
              {eligibleTasks.map((task) => (
                <label key={task.id} className="grid cursor-pointer gap-3 px-3 py-3 transition hover:bg-[#FFF8F4] sm:grid-cols-[20px_minmax(0,1fr)_120px_110px] sm:items-center">
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.has(task.id)}
                    onChange={() => toggleTask(task.id)}
                    className="h-4 w-4 accent-[#FD7124]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#2F2C2A]">{task.taskTemplate}</span>
                    <span className="mt-0.5 block truncate text-xs text-[#776B63]">{task.project} / {task.zone}</span>
                  </span>
                  <span className="text-xs font-semibold text-[#776B63]">{task.intensity} intensity</span>
                  <span className="text-xs font-semibold text-[#C95119]">{getTaskWorkload(task)} workload</span>
                </label>
              ))}
              {rangeValid && !eligibleTasks.length ? <p className="px-4 py-8 text-center text-sm font-semibold text-[#A09188]">No unassigned tasks in this period.</p> : null}
            </div>
          </div>
        ) : (
          <div className="min-h-0 overflow-y-auto px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#2F2C2A]">Assignment progress</p>
              <span className="text-xs font-semibold text-[#776B63]">{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F3D7C8]">
              <div className="h-full rounded-full bg-[#FD7124] transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-5 divide-y divide-[#F3D7C8] rounded-xl border border-[#F3D7C8]">
              {rows.map((row) => (
                <div key={row.task.id} className="grid gap-3 px-3 py-3 sm:grid-cols-[28px_minmax(0,1fr)_210px] sm:items-center">
                  <span className={`grid h-7 w-7 place-items-center rounded-full ${getStatusStyle(row.status)}`}>
                    {row.status === 'assigning' ? <LoaderCircle size={14} className="animate-spin" /> : row.status === 'assigned' ? <Check size={14} /> : row.status === 'failed' ? <AlertCircle size={14} /> : <span className="h-2 w-2 rounded-full bg-current opacity-40" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#2F2C2A]">{row.task.taskTemplate}</span>
                    <span className="mt-0.5 block truncate text-xs text-[#776B63]">{row.task.intensity} intensity / {getTaskWorkload(row.task)} workload</span>
                  </span>
                  <span className="min-w-0 sm:text-right">
                    <span className="block truncate text-xs font-semibold text-[#2F2C2A]">{row.worker?.name ?? (row.status === 'queued' ? 'Waiting' : 'Not assigned')}</span>
                    <span className={`mt-0.5 block truncate text-[10px] font-semibold ${row.status === 'failed' ? 'text-[#B84011]' : 'text-[#A09188]'}`}>
                      {row.error ?? (row.worker ? `${row.worker.fatigue}% fatigue / ${formatOvertime(row.worker.yesterdayWorkedMinutes)}` : 'Queued')}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-[#F3D7C8] bg-[#FFF8F4] px-5 py-4">
          <p className="text-xs font-semibold text-[#776B63]">
            {phase === 'select' ? `${selectedTaskIds.size} tasks ready` : phase === 'processing' ? 'Assignment is running' : `${rows.length - assignedCount} need attention`}
          </p>
          {phase === 'select' ? (
            <button
              type="button"
              onClick={() => void runAssignment()}
              disabled={!rangeValid || !selectedTaskIds.size}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#FD7124] px-4 text-sm font-semibold text-white transition hover:bg-[#E85F18] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <WandSparkles size={16} />
              Auto Assign
            </button>
          ) : phase === 'complete' ? (
            <button type="button" onClick={onClose} className="h-10 rounded-xl bg-[#FD7124] px-4 text-sm font-semibold text-white transition hover:bg-[#E85F18]">Done</button>
          ) : (
            <span className="inline-flex h-10 items-center gap-2 text-sm font-semibold text-[#C95119]"><LoaderCircle size={16} className="animate-spin" />Matching</span>
          )}
        </div>
      </div>
    </div>
  );
}

function pickWorker(task: Task, workers: Worker[], assignmentLoad: Map<string, number>) {
  return buildAssignmentCandidates(task, workers)
    .filter(({ worker }) => !['break', 'done', 'emergency'].includes(worker.status))
    .map((candidate) => ({ ...candidate, adjustedScore: candidate.score - (assignmentLoad.get(candidate.worker.id) ?? 0) * 22 }))
    .sort((left, right) => right.adjustedScore - left.adjustedScore)[0]?.worker ?? null;
}

function updateRow(rows: AssignmentRow[], taskId: string, update: Partial<AssignmentRow>) {
  return rows.map((row) => row.task.id === taskId ? { ...row, ...update } : row);
}

function getBulkTaskScore(task: Task) {
  const priorityScore = task.priority === 'Critical' ? 400 : task.priority === 'High' ? 300 : task.priority === 'Medium' ? 200 : 100;
  const intensityScore = task.intensity === 'High' ? 60 : task.intensity === 'Medium' ? 30 : 10;
  const workload = getTaskWorkload(task).toLowerCase();
  return priorityScore + intensityScore + (workload === 'high' ? 50 : workload === 'medium' ? 25 : 5);
}

function getTaskWorkload(task: Task) {
  return task.schedulerRecommendation.predictedWorkload ?? task.workload ?? 'Medium';
}

function getTaskDeadline(task: Task) {
  const date = new Date(task.deadline || task.due);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseInputDate(value: string) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date : null;
}

function startOfToday(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateTimeInput(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function getStatusStyle(status: AssignmentStatus) {
  if (status === 'assigned') return 'bg-[#E9F8EF] text-[#247A4D]';
  if (status === 'failed') return 'bg-[#FFEFE6] text-[#B84011]';
  if (status === 'assigning') return 'bg-[#FFF4DC] text-[#C95119]';
  return 'bg-[#F1F2F7] text-[#A09188]';
}

function formatOvertime(minutes: number) {
  const overtime = Math.max(0, minutes - 8 * 60);
  if (!overtime) return 'no overtime';
  const hours = Math.floor(overtime / 60);
  const remainder = overtime % 60;
  return `+${hours ? `${hours}h ` : ''}${remainder ? `${remainder}m` : ''} overtime`.replace('  ', ' ').trim();
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
