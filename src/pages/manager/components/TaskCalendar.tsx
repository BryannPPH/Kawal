import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, MapPin, UserRound, WandSparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Task, Worker } from '../../../types/workforce';

type CalendarMode = 'unassigned' | 'assigned';

type TaskCalendarProps = {
  tasks: Task[];
  workers: Worker[];
  now: Date;
  onOpenTask: (taskId: string) => void;
  onOpenWorker: (workerId: string) => void;
  onOpenAutoAssign: () => void;
};

export function TaskCalendar({ tasks, workers, now, onOpenTask, onOpenWorker, onOpenAutoAssign }: TaskCalendarProps) {
  const [mode, setMode] = useState<CalendarMode>('unassigned');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const unassignedCount = tasks.filter((task) => task.owner === 'Unassigned').length;
  const assignedCount = tasks.length - unassignedCount;
  const visibleTasks = useMemo(
    () => tasks.filter((task) => mode === 'unassigned' ? task.owner === 'Unassigned' : task.owner !== 'Unassigned'),
    [mode, tasks]
  );
  const weekStart = useMemo(() => getWeekStart(now, weekOffset), [now, weekOffset]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const selectedTask = visibleTasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedWorker = selectedTask ? workers.find((worker) => worker.name === selectedTask.owner) ?? null : null;
  const unscheduledTasks = visibleTasks.filter((task) => !getTaskDate(task));

  useEffect(() => {
    if (selectedTaskId && !visibleTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [selectedTaskId, visibleTasks]);

  const changeMode = (nextMode: CalendarMode) => {
    setMode(nextMode);
    setSelectedTaskId(null);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[#F3D7C8] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#F3D7C8] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex w-fit rounded-xl border border-[#F3D7C8] bg-[#FFF8F4] p-1" aria-label="Task calendar mode">
            <button
              type="button"
              onClick={() => changeMode('unassigned')}
              className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
                mode === 'unassigned' ? 'bg-[#FD7124] text-white shadow-sm' : 'text-[#776B63] hover:bg-white hover:text-[#2F2C2A]'
              }`}
            >
              Unassigned {unassignedCount}
            </button>
            <button
              type="button"
              onClick={() => changeMode('assigned')}
              className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
                mode === 'assigned' ? 'bg-[#FD7124] text-white shadow-sm' : 'text-[#776B63] hover:bg-white hover:text-[#2F2C2A]'
              }`}
            >
              Assigned {assignedCount}
            </button>
          </div>
          {mode === 'unassigned' ? (
            <button
              type="button"
              onClick={onOpenAutoAssign}
              disabled={!unassignedCount}
              className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-xl bg-[#FD7124] px-3 text-xs font-semibold text-white transition hover:bg-[#E85F18] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <WandSparkles size={15} />
              Auto Assign
            </button>
          ) : null}
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#2F2C2A]">
              <CalendarDays size={17} className="text-[#FD7124]" />
              Task Calendar
            </p>
            <p className="mt-1 truncate text-xs font-semibold text-[#A09188]">{formatWeekRange(weekDays)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((offset) => offset - 1)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#F3D7C8] bg-white text-[#776B63] transition hover:border-[#FD7124] hover:bg-[#FFEFE6] hover:text-[#2F2C2A]"
            aria-label="Previous week"
            title="Previous week"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="h-9 rounded-xl border border-[#F3D7C8] bg-white px-3 text-xs font-semibold text-[#C95119] transition hover:border-[#FD7124] hover:bg-[#FFEFE6]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((offset) => offset + 1)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#F3D7C8] bg-white text-[#776B63] transition hover:border-[#FD7124] hover:bg-[#FFEFE6] hover:text-[#2F2C2A]"
            aria-label="Next week"
            title="Next week"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-7 border-b border-[#F3D7C8] bg-[#FFF8F4]">
            {weekDays.map((day) => {
              const today = isSameDay(day, now);

              return (
                <div key={day.toISOString()} className="border-r border-[#F3D7C8] px-2 py-2 text-center last:border-r-0">
                  <span className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2 ${today ? 'bg-[#FD7124] text-white' : 'text-[#776B63]'}`}>
                    <span className="text-[10px] font-semibold uppercase">{formatWeekday(day)}</span>
                    <span className={`text-xs font-bold ${today ? 'text-white' : 'text-[#2F2C2A]'}`}>{day.getDate()}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7">
            {weekDays.map((day) => {
              const dayTasks = visibleTasks
                .filter((task) => {
                  const taskDate = getTaskDate(task);
                  return taskDate ? isSameDay(taskDate, day) : false;
                })
                .sort((left, right) => getTaskDate(left)!.getTime() - getTaskDate(right)!.getTime());

              return (
                <div key={day.toISOString()} className="min-h-[180px] border-r border-[#F3D7C8] p-1.5 last:border-r-0">
                  <div className="max-h-[240px] space-y-1 overflow-y-auto pr-0.5">
                    {dayTasks.map((task) => {
                      const taskWorker = workers.find((worker) => worker.name === task.owner);
                      const selected = selectedTaskId === task.id;

                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`w-full rounded-md border-l-[3px] px-2 py-1.5 text-left transition ${
                            selected ? 'border-l-[#FD7124] bg-[#FFEFE6]' : getTaskEventStyle(task)
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${getPriorityDot(task.priority)}`} />
                            <span className="truncate text-[11px] font-semibold leading-4 text-[#2F2C2A]">{task.taskTemplate}</span>
                          </span>
                          <span className="mt-0.5 flex items-center justify-between gap-2 pl-3 text-[9px] font-semibold text-[#8F8178]">
                            <span className="shrink-0">{formatTaskTime(task)}</span>
                            <span className="truncate">{taskWorker ? taskWorker.name : task.zone || 'No zone'}</span>
                          </span>
                        </button>
                      );
                    })}
                    {!dayTasks.length ? <p className="px-1 py-3 text-center text-[10px] font-semibold text-[#B4A59C]">No tasks</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {unscheduledTasks.length ? (
        <div className="border-t border-[#F3D7C8] px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase text-[#A09188]">Unscheduled</span>
            {unscheduledTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setSelectedTaskId(task.id)}
                className="rounded-lg bg-[#FFF8F4] px-2.5 py-1.5 text-xs font-semibold text-[#776B63] transition hover:bg-[#FFEFE6] hover:text-[#2F2C2A]"
              >
                {task.taskTemplate}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selectedTask ? (
        <div className="grid gap-3 border-t border-[#F3D7C8] bg-[#FFF8F4] px-4 py-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#2F2C2A]">
              <ClipboardList size={16} className="shrink-0 text-[#FD7124]" />
              <span className="truncate">{selectedTask.taskTemplate}</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-[#776B63]">
              <MapPin size={13} className="shrink-0 text-[#FAA745]" />
              {selectedTask.project} / {selectedTask.zone} / {formatTaskDeadline(selectedTask)}
            </p>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${
              selectedWorker ? 'bg-[#FD7124] text-white' : 'bg-white text-[#A09188]'
            }`}>
              {selectedWorker ? getInitials(selectedWorker.name) : <UserRound size={15} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase text-[#A09188]">Assigned worker</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-[#2F2C2A]">{selectedWorker?.name ?? 'Awaiting assignment'}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedWorker ? (
              <button
                type="button"
                onClick={() => onOpenWorker(selectedWorker.id)}
                className="h-9 rounded-xl border border-[#F3D7C8] bg-white px-3 text-xs font-semibold text-[#C95119] transition hover:border-[#FD7124] hover:bg-[#FFEFE6]"
              >
                View Worker
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onOpenTask(selectedTask.id)}
              className="h-9 rounded-xl bg-[#FD7124] px-3 text-xs font-semibold text-white transition hover:bg-[#E85F18]"
            >
              Open Task
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getWeekStart(date: Date, offset: number) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset + offset * 7);
  return start;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getTaskDate(task: Task) {
  const value = task.deadline || task.due;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
}

function formatWeekRange(days: Date[]) {
  const first = days[0];
  const last = days[days.length - 1];

  if (!first || !last) return '';

  return `${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(first)} - ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(last)}`;
}

function formatTaskTime(task: Task) {
  const date = getTaskDate(task);
  return date ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date) : 'No time';
}

function formatTaskDeadline(task: Task) {
  const date = getTaskDate(task);
  return date
    ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
    : 'No deadline';
}

function getTaskEventStyle(task: Task) {
  if (task.priority === 'Critical') return 'border-l-[#CF5A4F] bg-[#FFF1E8] hover:bg-[#FFEFE6]';
  if (task.priority === 'High') return 'border-l-[#FD7124] bg-[#FFF7E8] hover:bg-[#FFF4DC]';
  if (task.priority === 'Medium') return 'border-l-[#FAA745] bg-[#FFF8F4] hover:bg-[#FFF4DC]';
  return 'border-l-[#55936A] bg-[#F7FAF8] hover:bg-[#EDF6F0]';
}

function getPriorityDot(priority: string) {
  if (priority === 'Critical') return 'bg-[#CF5A4F]';
  if (priority === 'High') return 'bg-[#FD7124]';
  if (priority === 'Medium') return 'bg-[#FAA745]';
  return 'bg-[#55936A]';
}

function getInitials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}
