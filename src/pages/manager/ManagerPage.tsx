import { Bell, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { getManagerSectionFromPath, managerSectionMeta, managerSections } from '../../constants/managerNavigation';
import { taskTemplates } from '../../constants/taskTemplates';
import { useWorkforceData } from '../../hooks/useWorkforceData';
import type { ManagerSection } from '../../types/navigation';
import { ManagerSidebar } from './components/ManagerSidebar';
import { DashboardView } from './views/DashboardView';
import { IncidentCenterView } from './views/IncidentCenterView';
import { IoTView } from './views/IoTView';
import { PayrollView } from './views/PayrollView';
import { TasksView } from './views/TasksView';
import { WorkersView } from './views/WorkersView';

type ManagerPageProps = {
  onLogout: () => void;
};

type SearchResult = {
  id: string;
  type: 'page' | 'worker' | 'task' | 'zone' | 'alert';
  title: string;
  detail: string;
  section: ManagerSection;
  workerId?: string;
  notificationId?: string;
  keywords: string;
};

export function ManagerPage({ onLogout }: ManagerPageProps) {
  const { workers, tasks, notifications, loading, error, markNotificationRead, createTask, autoAssignTask } = useWorkforceData();
  const [selectedWorkerId, setSelectedWorkerId] = useState('budi');
  const [activeSection, setActiveSection] = useState<ManagerSection>(() => getManagerSectionFromPath(window.location.pathname));
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [taskTemplate, setTaskTemplate] = useState('');
  const [taskProject, setTaskProject] = useState('');
  const [taskZone, setTaskZone] = useState('');
  const [taskQuantity, setTaskQuantity] = useState('');
  const [taskUnit, setTaskUnit] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskPriority, setTaskPriority] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const activeMeta = managerSectionMeta[activeSection];
  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId) ?? workers[0];
  const unreadNotifications = notifications.filter((notification) => !notification.read);
  const searchResults = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();

    if (!trimmedQuery) {
      return [];
    }

    const zoneResults = Array.from(new Set([...workers.map((worker) => worker.zone), ...tasks.map((task) => task.zone)].filter(Boolean)))
      .map((zone) => {
        const workerCount = workers.filter((worker) => worker.zone === zone).length;
        const taskCount = tasks.filter((task) => task.zone === zone).length;
        return {
          id: `zone-${zone}`,
          type: 'zone',
          title: zone,
          detail: `${workerCount} workers / ${taskCount} tasks`,
          section: 'workers',
          workerId: workers.find((worker) => worker.zone === zone)?.id,
          keywords: [zone, 'zone', 'location', `${workerCount} workers`, `${taskCount} tasks`].join(' ')
        } satisfies SearchResult;
      });

    const results: SearchResult[] = [
      ...managerSections.map(({ section, title, label }) => ({
        id: `page-${section}`,
        type: 'page' as const,
        title,
        detail: `Open ${label}`,
        section,
        keywords: [title, label, section].join(' ')
      })),
      ...workers.map((worker) => ({
        id: `worker-${worker.id}`,
        type: 'worker' as const,
        title: worker.name,
        detail: `${worker.role} / ${worker.zone} / ${worker.status}`,
        section: 'workers' as const,
        workerId: worker.id,
        keywords: [worker.name, worker.role, worker.task, worker.zone, worker.status, worker.workload].join(' ')
      })),
      ...tasks.map((task) => ({
        id: `task-${task.id}`,
        type: 'task' as const,
        title: task.title,
        detail: `${task.project} / ${task.zone} / ${task.status}`,
        section: 'tasks' as const,
        keywords: [task.title, task.owner, task.project, task.zone, task.priority, task.status, task.notes].join(' ')
      })),
      ...zoneResults,
      ...notifications.map((notification) => ({
        id: `alert-${notification.id}`,
        type: 'alert' as const,
        title: notification.title,
        detail: notification.detail,
        section: notification.targetSection,
        workerId: notification.targetWorkerId,
        notificationId: notification.id,
        keywords: [notification.title, notification.detail, notification.targetLabel, notification.targetSection].join(' ')
      }))
    ];

    return results
      .filter((result) => `${result.title} ${result.detail} ${result.keywords}`.toLowerCase().includes(trimmedQuery))
      .slice(0, 8);
  }, [notifications, searchQuery, tasks, workers]);

  useEffect(() => {
    const handlePopState = () => setActiveSection(getManagerSectionFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const selectSection = (section: ManagerSection) => {
    window.history.pushState({}, '', managerSectionMeta[section].path);
    setActiveSection(section);
    setAlertsOpen(false);
  };

  const submitTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTaskError(null);
    setTaskSubmitting(true);

    try {
      await createTask({
        taskTemplate,
        project: taskProject,
        zone: taskZone,
        quantity: Number(taskQuantity),
        unit: taskUnit,
        deadline: taskDeadline,
        priority: taskPriority,
        notes: taskNotes
      });
      setTaskTemplate('');
      setTaskProject('');
      setTaskZone('');
      setTaskQuantity('');
      setTaskUnit('');
      setTaskDeadline('');
      setTaskPriority('');
      setTaskNotes('');
      setCreateTaskOpen(false);
      selectSection('tasks');
    } catch (caughtError) {
      setTaskError(caughtError instanceof Error ? caughtError.message : 'Unable to create task');
    } finally {
      setTaskSubmitting(false);
    }
  };

  const openNotificationTarget = (notification: (typeof notifications)[number]) => {
    if (notification.targetWorkerId) {
      const targetWorker = workers.find((worker) => worker.id === notification.targetWorkerId);

      if (targetWorker) {
        setSelectedWorkerId(targetWorker.id);
      }
    }

    markNotificationRead(notification.id);
    selectSection(notification.targetSection);
  };

  const openSearchResult = (result: SearchResult) => {
    if (result.workerId) {
      setSelectedWorkerId(result.workerId);
    }

    if (result.notificationId) {
      const notification = notifications.find((item) => item.id === result.notificationId);

      if (notification) {
        openNotificationTarget(notification);
      }
    } else {
      selectSection(result.section);
    }

    setSearchQuery('');
    setSearchOpen(false);
  };

  const submitSearch = () => {
    const [firstResult] = searchResults;

    if (firstResult) {
      openSearchResult(firstResult);
    }
  };

  const renderSection = () => {
    if (activeSection === 'workers') {
      return <WorkersView workers={workers} selectedWorker={selectedWorker} onSelectWorker={(worker) => setSelectedWorkerId(worker.id)} />;
    }

    if (activeSection === 'tasks') {
      return <TasksView tasks={tasks} onAutoAssign={autoAssignTask} />;
    }

    if (activeSection === 'payroll') {
      return <PayrollView workers={workers} />;
    }

    if (activeSection === 'iot') {
      return <IoTView />;
    }

    if (activeSection === 'incidents') {
      return <IncidentCenterView />;
    }

    return (
      <DashboardView
        workers={workers}
        tasks={tasks}
        selectedWorker={selectedWorker}
        onSelectWorker={(worker) => setSelectedWorkerId(worker.id)}
      />
    );
  };

  return (
    <div className="flex min-h-screen bg-[#F1F2F7]">
      <ManagerSidebar activeSection={activeSection} onSelectSection={selectSection} />

      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-[#F3D7C8] bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-3xl xl:max-w-4xl">
              <div className="flex h-11 items-center rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] px-3 text-[#A09188] transition focus-within:border-[#FD7124] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#FFEFE6]">
                <Search size={17} />
                <input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      submitSearch();
                    }

                    if (event.key === 'Escape') {
                      setSearchQuery('');
                      setSearchOpen(false);
                    }
                  }}
                  className="ml-2 h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-[#2F2C2A] outline-none placeholder:text-[#A09188]"
                  placeholder="Search workers, tasks, zones, alerts"
                  type="search"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    title="Clear search"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSearchQuery('');
                      setSearchOpen(false);
                    }}
                    className="grid h-7 w-7 place-items-center rounded-md text-[#776B63] transition hover:bg-[#FFEFE6] hover:text-[#2F2C2A]"
                  >
                    <X size={15} />
                  </button>
                ) : null}
              </div>

              {searchOpen && searchQuery.trim() ? (
                <div className="absolute left-0 right-0 top-12 z-30 rounded-lg border border-[#F3D7C8] bg-white p-2 shadow-[0_18px_50px_rgba(76,48,35,0.16)]">
                  {searchResults.length ? (
                    <div className="max-h-[360px] overflow-y-auto">
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => openSearchResult(result)}
                          className="group grid w-full gap-1 rounded-md px-3 py-3 text-left transition hover:bg-[#FFEFE6]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="min-w-0 truncate text-sm font-semibold text-[#2F2C2A]">{result.title}</p>
                            <span className="shrink-0 rounded bg-[#FFF8F4] px-2 py-1 text-[11px] font-semibold capitalize text-[#776B63] group-hover:bg-white">
                              {result.type}
                            </span>
                          </div>
                          <p className="truncate text-xs text-[#776B63]">{result.detail}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="px-3 py-4 text-sm text-[#776B63]">No results found.</p>
                  )}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  aria-label="Priority alerts"
                  title="Priority alerts"
                  onClick={() => setAlertsOpen((value) => !value)}
                  className="relative grid h-10 w-10 place-items-center rounded-md border border-[#F3D7C8] bg-white text-[#5F5A56] transition hover:bg-[#FFEFE6] hover:text-[#2F2C2A]"
                >
                  <Bell size={17} />
                  {unreadNotifications.length > 0 ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#FD7124]" /> : null}
                </button>

                {alertsOpen ? (
                  <div className="absolute right-0 top-12 z-30 w-[320px] rounded-lg border border-[#F3D7C8] bg-white p-3 shadow-[0_18px_50px_rgba(76,48,35,0.16)]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#2F2C2A]">Priority Alerts</p>
                      <span className="rounded bg-[#FFEFE6] px-2 py-1 text-xs font-semibold text-[#C95119]">
                        {unreadNotifications.length} unread
                      </span>
                    </div>
                    {error ? <p className="mb-3 rounded-md bg-[#FFF4DC] px-3 py-2 text-xs font-semibold text-[#8A4B02]">Using local fallback data</p> : null}
                    <div className="space-y-2">
                      {notifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openNotificationTarget(item)}
                          className={`group w-full rounded-md border border-[#F3D7C8] p-3 text-left transition hover:border-[#FD7124] hover:bg-[#FFEFE6] ${
                            item.read ? 'bg-white opacity-75' : 'bg-[#FFF8F4]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[#2F2C2A]">{item.title}</p>
                            <span className={`h-2.5 w-2.5 rounded-full ${item.read ? 'bg-[#D9C5B9]' : item.tone === 'danger' ? 'bg-[#FD7124]' : item.tone === 'warning' ? 'bg-[#FAA745]' : 'bg-[#C95119]'}`} />
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[#776B63]">{item.detail}</p>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-[#C95119]">{item.targetLabel}</span>
                            <span className="rounded bg-white px-2 py-1 text-[11px] font-semibold capitalize text-[#776B63] transition group-hover:text-[#2F2C2A]">
                              {item.targetSection}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <Button onClick={onLogout}>Logout</Button>
              <Button variant="primary" onClick={() => setCreateTaskOpen(true)}>Create Task</Button>
            </div>
          </div>
        </header>

        <div className="px-5 py-6 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-normal text-[#2F2C2A]">{activeMeta.title}</h1>
            {loading ? <span className="rounded bg-[#FFEFE6] px-2 py-1 text-xs font-semibold text-[#C95119]">Loading database</span> : null}
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {managerSections.map(({ section, label }) => (
              <button
                key={section}
                type="button"
                onClick={() => selectSection(section)}
                className={`h-9 shrink-0 rounded-md px-3 text-sm font-semibold capitalize ${
                  activeSection === section ? 'bg-[#FD7124] text-white' : 'border border-[#F3D7C8] bg-white text-[#5F5A56]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-6">{renderSection()}</div>
        </div>
      </section>

      {createTaskOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#2F2C2A]/30 px-4">
          <form onSubmit={submitTask} className="max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-lg border border-[#F3D7C8] bg-white p-5 shadow-[0_24px_80px_rgba(76,48,35,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-[#2F2C2A]">Create Task</p>
                <p className="mt-1 text-sm text-[#776B63]">The scheduler predicts workload, duration, feasibility, and ranked workers after creation.</p>
              </div>
              <button
                type="button"
                aria-label="Close create task"
                title="Close"
                onClick={() => setCreateTaskOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#776B63] transition hover:bg-[#FFEFE6] hover:text-[#2F2C2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7124] focus-visible:ring-offset-2"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#2F2C2A]">Task Template</span>
                  <select value={taskTemplate} onChange={(event) => setTaskTemplate(event.target.value)} className="field-input mt-2" required>
                    <option value="">Select task template</option>
                    {taskTemplates.map((template) => <option key={template.name} value={template.name}>{template.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#2F2C2A]">Project</span>
                  <input value={taskProject} onChange={(event) => setTaskProject(event.target.value)} className="field-input mt-2" placeholder="Project" required />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#2F2C2A]">Zone</span>
                  <input value={taskZone} onChange={(event) => setTaskZone(event.target.value)} className="field-input mt-2" placeholder="Zone" required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#2F2C2A]">Deadline</span>
                  <input value={taskDeadline} onChange={(event) => setTaskDeadline(event.target.value)} type="datetime-local" className="field-input mt-2" required />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold text-[#2F2C2A]">Quantity</span>
                  <input value={taskQuantity} onChange={(event) => setTaskQuantity(event.target.value)} type="number" min="1" className="field-input mt-2" placeholder="Quantity" required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#2F2C2A]">Unit</span>
                  <input value={taskUnit} onChange={(event) => setTaskUnit(event.target.value)} className="field-input mt-2" placeholder="Unit" required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#2F2C2A]">Priority</span>
                  <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)} className="field-input mt-2" required>
                    <option value="">Select priority</option>
                    {['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority}>{priority}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-[#2F2C2A]">Notes</span>
                <textarea value={taskNotes} onChange={(event) => setTaskNotes(event.target.value)} className="field-input mt-2 min-h-24 py-3" placeholder="Notes" />
              </label>
            </div>

            {taskError ? <p className="mt-4 rounded-md bg-[#FFEFE6] px-3 py-2 text-sm font-semibold text-[#B84011]">{taskError}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setCreateTaskOpen(false)}>Cancel</Button>
              <button type="submit" disabled={taskSubmitting} className="inline-flex h-10 items-center justify-center rounded-md bg-[#FD7124] px-4 text-sm font-semibold text-white transition hover:bg-[#E85F18] disabled:cursor-wait disabled:opacity-60">
                {taskSubmitting ? 'Creating...' : 'Save Task'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
