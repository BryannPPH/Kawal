import { Pill } from '../../../components/ui/Pill';
import { toneStyles } from '../../../constants/workforce';
import type { Task } from '../../../types/workforce';

export function TaskPanel({ tasks }: { tasks: Task[] }) {
  return (
    <section className="rounded-lg border border-[#F3D7C8] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#2F2C2A]">Tasks</p>
        <Pill className="bg-[#F1F2F7] text-[#5F5A56]">{tasks.length} active</Pill>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="rounded-lg border border-[#F3D7C8] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#2F2C2A]">{task.title}</p>
                <p className="mt-1 text-xs text-[#776B63]">{task.owner}</p>
              </div>
              <Pill className={toneStyles[task.tone]}>{task.status}</Pill>
            </div>
            <p className="mt-3 text-xs font-medium text-[#776B63]">Due {task.due}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
