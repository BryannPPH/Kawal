import { Check, ClipboardList, Search, ShieldAlert, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { RouteLink } from '../../components/ui/RouteLink';
import { workers } from '../../constants/workforce';
import type { RouteName } from '../../types/navigation';
import { AlertPanel } from './components/AlertPanel';
import { AssignmentPanel } from './components/AssignmentPanel';
import { ManagerSidebar } from './components/ManagerSidebar';
import { MetricCard } from './components/MetricCard';
import { TaskPanel } from './components/TaskPanel';
import { WorkerBoard } from './components/WorkerBoard';

type ManagerPageProps = {
  onNavigate: (route: RouteName) => void;
};

const metrics = [
  { label: 'Active Workers', value: '84', detail: '11 currently on break', icon: Users },
  { label: 'Open Tasks', value: '128', detail: '14 waiting review', icon: ClipboardList },
  { label: 'Completion', value: '67%', detail: 'Today across all zones', icon: Check },
  { label: 'High Risk', value: '6', detail: '2 fewer than yesterday', icon: ShieldAlert }
];

export function ManagerPage({ onNavigate }: ManagerPageProps) {
  const [selectedWorker, setSelectedWorker] = useState(workers[0]);

  return (
    <div className="flex min-h-screen bg-[#F1F2F7]">
      <ManagerSidebar />

      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-[#F3D7C8] bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex h-10 max-w-xl items-center rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] px-3 text-[#A09188]">
              <Search size={16} />
              <span className="ml-2 text-sm">Search workers, tasks, zones</span>
            </div>
            <div className="flex items-center gap-2">
              <RouteLink to="worker" onNavigate={onNavigate}>Worker App</RouteLink>
              <Button variant="primary">Create Task</Button>
            </div>
          </div>
        </header>

        <div className="px-5 py-6 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#FD7124]">Garudie Workforce</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal text-[#2F2C2A]">Manager Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#776B63]">
                Assignment, worker status, and safety review in one clean operational view.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[#F3D7C8] bg-white px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-[#FD7124] text-sm font-bold text-white">PM</span>
              <div>
                <p className="text-sm font-semibold text-[#2F2C2A]">Project Manager</p>
                <p className="text-xs text-[#776B63]">Garuda Tower</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((item) => (
              <MetricCard key={item.label} {...item} />
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <AssignmentPanel selectedWorker={selectedWorker} onSelectWorker={setSelectedWorker} />
              <WorkerBoard selectedWorker={selectedWorker} onSelectWorker={setSelectedWorker} />
            </div>
            <aside className="space-y-6">
              <TaskPanel />
              <AlertPanel />
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
