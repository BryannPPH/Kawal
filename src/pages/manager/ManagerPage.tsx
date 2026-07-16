import { Bell, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
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

const managerSectionMeta: Record<ManagerSection, { title: string; description: string; eyebrow: string; path: string }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'Assignment, worker status, and safety review in one clean operational view.',
    eyebrow: 'Garudie Workforce',
    path: '/manager'
  },
  workers: {
    title: 'Workers',
    description: 'Monitor crew availability, fatigue, assignment fit, and zone coverage.',
    eyebrow: 'Crew Operations',
    path: '/manager/workers'
  },
  tasks: {
    title: 'Tasks',
    description: 'Track assignment ownership, review status, and safety-critical work.',
    eyebrow: 'Task Control',
    path: '/manager/tasks'
  },
  payroll: {
    title: 'Payroll',
    description: 'Review shift earnings, bonus eligibility, and payout readiness.',
    eyebrow: 'Compensation',
    path: '/manager/payroll'
  },
  iot: {
    title: 'IoT Panel',
    description: 'Monitor wearable connectivity, SOS incidents, rest commands, and risk policy state.',
    eyebrow: 'Device Safety',
    path: '/manager/iot'
  },
  incidents: {
    title: 'Incident Center',
    description: 'Monitor SOS alerts, near-miss reports, emergency history, and escalation actions.',
    eyebrow: 'FR-SOS / FR-INC',
    path: '/manager/incidents'
  }
};

function getManagerSectionFromPath(): ManagerSection {
  const section = window.location.pathname.split('/')[2];

  if (section === 'workers' || section === 'tasks' || section === 'payroll' || section === 'iot' || section === 'incidents') {
    return section;
  }

  return 'dashboard';
}

export function ManagerPage({ onLogout }: ManagerPageProps) {
  const { workers, tasks, notifications, loading, error, markNotificationRead, createTask } = useWorkforceData();
  const [selectedWorkerId, setSelectedWorkerId] = useState('budi');
  const [activeSection, setActiveSection] = useState<ManagerSection>(getManagerSectionFromPath);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [taskTemplate, setTaskTemplate] = useState('');
  const [taskProject, setTaskProject] = useState('');
  const [taskZone, setTaskZone] = useState('');
  const [taskQuantity, setTaskQuantity] = useState('');
  const [taskUnit, setTaskUnit] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskPriority, setTaskPriority] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskOwner, setTaskOwner] = useState('');
  const [taskError, setTaskError] = useState<string | null>(null);
  const activeMeta = managerSectionMeta[activeSection];
  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId) ?? workers[0];
  const unreadNotifications = notifications.filter((notification) => !notification.read);

  useEffect(() => {
    const handlePopState = () => setActiveSection(getManagerSectionFromPath());
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

    try {
      await createTask({
        taskTemplate,
        project: taskProject,
        zone: taskZone,
        quantity: Number(taskQuantity),
        unit: taskUnit,
        deadline: taskDeadline,
        priority: taskPriority,
        notes: taskNotes,
        owner: taskOwner
      });
      setTaskTemplate('');
      setTaskProject('');
      setTaskZone('');
      setTaskQuantity('');
      setTaskUnit('');
      setTaskDeadline('');
      setTaskPriority('');
      setTaskNotes('');
      setTaskOwner('');
      setCreateTaskOpen(false);
      selectSection('tasks');
    } catch (caughtError) {
      setTaskError(caughtError instanceof Error ? caughtError.message : 'Unable to create task');
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

  const renderSection = () => {
    if (activeSection === 'workers') {
      return <WorkersView workers={workers} selectedWorker={selectedWorker} onSelectWorker={(worker) => setSelectedWorkerId(worker.id)} />;
    }

    if (activeSection === 'tasks') {
      return <TasksView tasks={tasks} />;
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
            <div className="flex h-10 max-w-xl items-center rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] px-3 text-[#A09188]">
              <Search size={16} />
              <span className="ml-2 text-sm">Search workers, tasks, zones</span>
            </div>
            <div className="flex items-center gap-2">
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
                          key={item.title}
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
            {(['dashboard', 'workers', 'tasks', 'payroll', 'iot', 'incidents'] as const).map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => selectSection(section)}
                className={`h-9 shrink-0 rounded-md px-3 text-sm font-semibold capitalize ${
                  activeSection === section ? 'bg-[#FD7124] text-white' : 'border border-[#F3D7C8] bg-white text-[#5F5A56]'
                }`}
              >
                {section}
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
                <p className="mt-1 text-sm text-[#776B63]">Capture the task workflow, then review the placeholder scheduler recommendation in Tasks.</p>
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
                  <input value={taskTemplate} onChange={(event) => setTaskTemplate(event.target.value)} className="field-input mt-2" placeholder="Task template" required />
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
                  <input value={taskDeadline} onChange={(event) => setTaskDeadline(event.target.value)} className="field-input mt-2" placeholder="Deadline" required />
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
                <span className="text-sm font-semibold text-[#2F2C2A]">Selected worker</span>
                <select value={taskOwner} onChange={(event) => setTaskOwner(event.target.value)} className="field-input mt-2">
                  <option value="">Select worker</option>
                  {workers.map((worker) => <option key={worker.id}>{worker.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#2F2C2A]">Notes</span>
                <textarea value={taskNotes} onChange={(event) => setTaskNotes(event.target.value)} className="field-input mt-2 min-h-24 py-3" placeholder="Notes" />
              </label>
            </div>

            {taskError ? <p className="mt-4 rounded-md bg-[#FFEFE6] px-3 py-2 text-sm font-semibold text-[#B84011]">{taskError}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setCreateTaskOpen(false)}>Cancel</Button>
              <button type="submit" className="inline-flex h-10 items-center justify-center rounded-md bg-[#FD7124] px-4 text-sm font-semibold text-white transition hover:bg-[#E85F18]">
                Save Task
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
