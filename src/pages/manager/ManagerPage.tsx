import { Bell, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { RouteLink } from '../../components/ui/RouteLink';
import { notifications, workers } from '../../constants/workforce';
import type { ManagerSection, RouteName } from '../../types/navigation';
import { ManagerSidebar } from './components/ManagerSidebar';
import { DashboardView } from './views/DashboardView';
import { PayrollView } from './views/PayrollView';
import { TasksView } from './views/TasksView';
import { WorkersView } from './views/WorkersView';

type ManagerPageProps = {
  onNavigate: (route: RouteName) => void;
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
  }
};

function getManagerSectionFromPath(): ManagerSection {
  const section = window.location.pathname.split('/')[2];

  if (section === 'workers' || section === 'tasks' || section === 'payroll') {
    return section;
  }

  return 'dashboard';
}

export function ManagerPage({ onNavigate }: ManagerPageProps) {
  const [selectedWorker, setSelectedWorker] = useState(workers[0]);
  const [activeSection, setActiveSection] = useState<ManagerSection>(getManagerSectionFromPath);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const activeMeta = managerSectionMeta[activeSection];

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

  const openNotificationTarget = (notification: (typeof notifications)[number]) => {
    if (notification.targetWorkerId) {
      const targetWorker = workers.find((worker) => worker.id === notification.targetWorkerId);

      if (targetWorker) {
        setSelectedWorker(targetWorker);
      }
    }

    selectSection(notification.targetSection);
  };

  const renderSection = () => {
    if (activeSection === 'workers') {
      return <WorkersView selectedWorker={selectedWorker} onSelectWorker={setSelectedWorker} />;
    }

    if (activeSection === 'tasks') {
      return <TasksView />;
    }

    if (activeSection === 'payroll') {
      return <PayrollView />;
    }

    return <DashboardView selectedWorker={selectedWorker} onSelectWorker={setSelectedWorker} />;
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
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#FD7124]" />
                </button>

                {alertsOpen ? (
                  <div className="absolute right-0 top-12 z-30 w-[320px] rounded-lg border border-[#F3D7C8] bg-white p-3 shadow-[0_18px_50px_rgba(76,48,35,0.16)]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#2F2C2A]">Priority Alerts</p>
                      <span className="rounded bg-[#FFEFE6] px-2 py-1 text-xs font-semibold text-[#C95119]">{notifications.length}</span>
                    </div>
                    <div className="space-y-2">
                      {notifications.map((item) => (
                        <button
                          key={item.title}
                          type="button"
                          onClick={() => openNotificationTarget(item)}
                          className="group w-full rounded-md border border-[#F3D7C8] bg-[#FFF8F4] p-3 text-left transition hover:border-[#FD7124] hover:bg-[#FFEFE6]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[#2F2C2A]">{item.title}</p>
                            <span className={`h-2.5 w-2.5 rounded-full ${item.tone === 'danger' ? 'bg-[#FD7124]' : item.tone === 'warning' ? 'bg-[#FAA745]' : 'bg-[#C95119]'}`} />
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
              <RouteLink to="worker" onNavigate={onNavigate}>Worker App</RouteLink>
              <Button variant="primary">Create Task</Button>
            </div>
          </div>
        </header>

        <div className="px-5 py-6 sm:px-8 lg:px-10">
          <h1 className="text-2xl font-semibold tracking-normal text-[#2F2C2A]">{activeMeta.title}</h1>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {(['dashboard', 'workers', 'tasks', 'payroll'] as const).map((section) => (
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
    </div>
  );
}
