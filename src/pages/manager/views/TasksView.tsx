import { ClipboardCheck, ClipboardList, Clock, ShieldAlert } from 'lucide-react';
import { Pill } from '../../../components/ui/Pill';
import { toneStyles } from '../../../constants/workforce';
import type { Task } from '../../../types/workforce';
import { MetricCard } from '../components/MetricCard';
import { TaskPanel } from '../components/TaskPanel';

export function TasksView({ tasks }: { tasks: Task[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Total Tasks" value={String(tasks.length)} detail="Active operational tasks" icon={ClipboardList} />
          <MetricCard label="Ready Review" value="1" detail="Proof waiting approval" icon={ClipboardCheck} />
          <MetricCard label="Safety Open" value="1" detail="Needs supervisor action" icon={ShieldAlert} />
        </div>

        <section className="rounded-lg border border-[#F3D7C8] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#2F2C2A]">Task Timeline</p>
              <p className="mt-1 text-sm text-[#776B63]">Operational tasks grouped by priority and ownership.</p>
            </div>
            <Clock size={18} className="text-[#FAA745]" />
          </div>

          <div className="mt-5 space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="grid gap-3 rounded-lg border border-[#F3D7C8] p-4 md:grid-cols-[minmax(0,1fr)_130px_110px] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#2F2C2A]">{task.title}</p>
                  <p className="mt-1 text-sm text-[#776B63]">{task.owner}</p>
                </div>
                <Pill className={toneStyles[task.tone]}>{task.status}</Pill>
                <p className="text-sm font-semibold text-[#5F5A56]">Due {task.due}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <TaskPanel tasks={tasks} />
    </div>
  );
}
