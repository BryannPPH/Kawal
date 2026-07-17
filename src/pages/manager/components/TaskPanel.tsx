import { Pill } from '../../../components/ui/Pill';
import { toneStyles } from '../../../constants/workforce';
import type { Task } from '../../../types/workforce';

export function TaskPanel({ tasks }: { tasks: Task[] }) {
  const urgentTasks = tasks.filter((task) => ['high', 'critical'].includes(task.priority.toLowerCase())).length;
  const reviewTasks = tasks.filter((task) => task.status.toLowerCase().includes('review')).length;

  return (
    <section className="rounded-2xl border border-[#F3D7C8] bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#2F2C2A]">Task Shape</p>
          <p className="mt-1 text-sm text-[#776B63]">A light summary beside the timeline.</p>
        </div>
        <Pill className="bg-[#F1F2F7] text-[#5F5A56]">{tasks.length} active</Pill>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="Urgent" value={urgentTasks} tone="orange" />
        <MiniStat label="Review" value={reviewTasks} tone="green" />
      </div>

      <div className="space-y-3">
        {tasks.slice(0, 4).map((task) => {
          const workload = task.schedulerRecommendation.predictedWorkload ?? task.workload ?? 'Medium';
          const workloadWidth = workload === 'High' ? 88 : workload === 'Medium' ? 58 : 34;

          return (
            <div key={task.id} className="rounded-2xl border border-[#F3D7C8] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#2F2C2A]">{task.taskTemplate}</p>
                  <p className="mt-1 text-xs text-[#776B63]">{task.project} / {task.zone}</p>
                </div>
                <Pill className={toneStyles[task.tone]}>{task.priority || task.status}</Pill>
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-[#776B63]">
                  <span>{task.intensity} intensity</span>
                  <span>{workload} workload</span>
                </div>
                <div className="h-2 rounded-full bg-[#F5D8C8]">
                  <div className="h-2 rounded-full bg-[#FD7124]" style={{ width: `${workloadWidth}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'orange' | 'green' }) {
  return (
    <div className={`mb-4 rounded-2xl p-4 ${tone === 'orange' ? 'bg-[#FFEFE6]' : 'bg-[#EAF5ED]'}`}>
      <p className="text-xs font-semibold text-[#776B63]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone === 'orange' ? 'text-[#C95119]' : 'text-[#55936A]'}`}>{value}</p>
    </div>
  );
}
