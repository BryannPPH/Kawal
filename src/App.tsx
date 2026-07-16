import {
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Cone,
  Filter,
  HardHat,
  HelpCircle,
  Home,
  LayoutDashboard,
  MapPin,
  MessageSquareWarning,
  PhoneCall,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TimerReset,
  User,
  Users,
  WalletCards,
  Wind
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const orange = '#FD7124';
const purple = '#7D7AE8';

const managerMenu = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Workers', icon: Users },
  { label: 'Tasks', icon: ClipboardList },
  { label: 'Notifications', icon: Bell }
];

const workerNav = [
  { label: 'Home', icon: Home, active: true },
  { label: 'Tasks', icon: ClipboardCheck },
  { label: 'Report', icon: MessageSquareWarning },
  { label: 'Profile', icon: User }
];

const kpis = [
  { label: 'Workers Active', value: '84', trend: '+12%', icon: Users },
  { label: 'Assignments Today', value: '128', trend: '+18%', icon: ClipboardList },
  { label: 'Completed Tasks', value: '67', trend: '+9%', icon: Check },
  { label: 'Waiting Review', value: '14', trend: '4 new', icon: ClipboardCheck },
  { label: 'Workers on Break', value: '11', trend: 'balanced', icon: TimerReset },
  { label: 'High Risk Workers', value: '6', trend: '-2', icon: ShieldAlert }
];

const workerColumns = [
  {
    title: 'Waiting Assignment',
    color: '#e9ecf5',
    workers: [
      { name: 'Rizky', task: 'Awaiting steel crew', time: '00:00', workload: 'Low', fatigue: '12%', pay: 'Rp95.000' },
      { name: 'Dewi', task: 'Ready near Zone B', time: '00:00', workload: 'Low', fatigue: '18%', pay: 'Rp120.000' }
    ]
  },
  {
    title: 'Working',
    color: orange,
    workers: [
      { name: 'Budi', task: 'Install steel beam', time: '02:14', workload: 'Balanced', fatigue: '24%', pay: 'Rp180.000' },
      { name: 'Agus', task: 'Crane signal check', time: '01:42', workload: 'Medium', fatigue: '36%', pay: 'Rp150.000' }
    ]
  },
  {
    title: 'On Break',
    color: purple,
    workers: [
      { name: 'Sari', task: 'Mandatory break', time: '00:12', workload: 'Medium', fatigue: '58%', pay: 'Rp145.000' }
    ]
  },
  {
    title: 'Finished',
    color: '#20B15A',
    workers: [
      { name: 'Dimas', task: 'Scaffold inspection', time: '03:20', workload: 'High', fatigue: '44%', pay: 'Rp210.000' }
    ]
  }
];

const taskColumns = [
  { title: 'Unassigned', tasks: ['Wet surface cleanup', 'Anchor point setup'] },
  { title: 'Assigned', tasks: ['Harness audit', 'Material staging'] },
  { title: 'Working', tasks: ['Steel beam install', 'Crane signal check'] },
  { title: 'Waiting Review', tasks: ['Scaffold photo proof'] },
  { title: 'Completed', tasks: ['Morning safety sweep'] }
];

const notifications = [
  { title: 'Worker finished assignment', detail: 'Dimas submitted scaffold inspection', tone: 'success' },
  { title: 'Hazard report', detail: 'Wet surface reported near Zone C', tone: 'warning' },
  { title: 'Possible fatigue', detail: 'Sari reached fatigue threshold', tone: 'danger' },
  { title: 'Assignment accepted', detail: 'Budi accepted steel installation', tone: 'info' }
];

type RouteName = 'manager' | 'worker';

function getRouteFromPath(): RouteName {
  return window.location.pathname.startsWith('/worker') ? 'worker' : 'manager';
}

function SmallButton({ children, filled = false }: { children: ReactNode; filled?: boolean }) {
  return (
    <button
      className={`rounded-md px-4 py-2 text-xs font-semibold shadow-[0_5px_14px_rgba(36,45,73,0.05)] ${
        filled ? 'bg-[#FD7124] text-white' : 'border border-[#eceef6] bg-white text-[#ff8a1f]'
      }`}
    >
      {children}
    </button>
  );
}

function RouteLink({
  to,
  children,
  filled = false,
  onNavigate
}: {
  to: RouteName;
  children: ReactNode;
  filled?: boolean;
  onNavigate: (route: RouteName) => void;
}) {
  return (
    <a
      href={`/${to}`}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(to);
      }}
      className={`rounded-md px-4 py-2 text-xs font-semibold shadow-[0_5px_14px_rgba(36,45,73,0.05)] ${
        filled ? 'bg-[#FD7124] text-white' : 'border border-[#eceef6] bg-white text-[#ff8a1f]'
      }`}
    >
      {children}
    </a>
  );
}

function KpiCard({ label, value, trend, icon: Icon }: (typeof kpis)[number]) {
  return (
    <div className="rounded-lg border border-[#edf0f6] bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#8d93a3]">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-md bg-[#FFEFE6] text-[#FD7124]">
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold text-black">{value}</p>
      <p className="mt-2 text-xs font-semibold text-[#20B15A]">{trend} <span className="font-medium text-[#8d93a3]">today</span></p>
    </div>
  );
}

function CompletionChart() {
  const bars = [64, 48, 76, 42, 82, 55, 71, 45, 66, 52, 74, 86];

  return (
    <div className="mt-6">
      <div className="relative h-[132px] border-b border-dashed border-[#e7eaf3]">
        {[0, 1, 2, 3].map((line) => (
          <span key={line} className="absolute left-0 right-0 border-t border-dashed border-[#e7eaf3]" style={{ top: `${line * 31}px` }} />
        ))}
        <div className="absolute inset-x-0 bottom-0 flex h-[118px] items-end justify-between">
          {bars.map((value, index) => (
            <div key={index} className="flex w-9 items-end justify-center gap-2">
              <span className="w-2 rounded-t-sm bg-[#ff9f33]" style={{ height: `${value}%` }} />
              <span className="w-2 rounded-t-sm bg-[#e8ebf2]" style={{ height: `${Math.max(28, value - 16 + (index % 3) * 8)}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[#bbc0ce]">
        {bars.map((_, index) => <span key={index}>{String(index + 1).padStart(2, '0')}</span>)}
      </div>
    </div>
  );
}

function StatusDonut() {
  return (
    <div className="mt-4 flex items-center justify-center">
      <div className="relative h-44 w-44">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="42" fill="none" stroke="#cbd2ff" strokeWidth="16" strokeDasharray="70 194" />
          <circle cx="60" cy="60" r="42" fill="none" stroke="#7D7AE8" strokeWidth="16" strokeDasharray="78 186" strokeDashoffset="-70" />
          <circle cx="60" cy="60" r="42" fill="none" stroke="#ff9f33" strokeWidth="16" strokeDasharray="92 172" strokeDashoffset="-148" />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <p className="text-3xl font-bold text-black">84</p>
          <p className="text-xs font-medium text-[#8d93a3]">active</p>
        </div>
      </div>
    </div>
  );
}

function AiAssignmentPanel() {
  const reasons = [
    ['Certified', 96],
    ['Available', 92],
    ['Nearby', 88],
    ['Balanced workload', 84],
    ['Low fatigue', 91]
  ];

  return (
    <section className="rounded-lg border border-[#e8ebf3] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-black"><Sparkles size={16} className="text-[#FD7124]" /> Smart Workforce Assignment</p>
          <p className="mt-2 text-sm text-[#8d93a3]">System recommends the best worker for steel installation.</p>
        </div>
        <SmallButton filled>Assign Automatically</SmallButton>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-lg bg-[#252d45] p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#FFEFE6] text-sm font-bold text-[#FD7124]">BU</span>
            <div>
              <p className="text-xs text-white/55">Recommended Worker</p>
              <p className="text-lg font-bold">Budi</p>
            </div>
          </div>
          <p className="mt-6 text-5xl font-black text-[#FAA745]">94%</p>
          <p className="mt-1 text-sm text-white/70">Match score</p>
          <p className="mt-5 text-sm font-semibold">Estimated completion</p>
          <p className="mt-1 text-xl font-bold">2h 15m</p>
        </div>

        <div>
          <div className="grid gap-3 sm:grid-cols-5">
            {reasons.map(([label, score]) => (
              <div key={label} className="rounded-md bg-[#F7F8FC] p-3">
                <p className="text-xs font-semibold text-[#8d93a3]">{label}</p>
                <p className="mt-2 text-lg font-bold text-black">{score}%</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {[
              ['Availability', 40],
              ['Skill Match', 30],
              ['Current Workload', 20],
              ['Fatigue', 10]
            ].map(([label, value]) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-xs font-semibold text-[#6f7382]">
                  <span>{label}</span>
                  <span>{value}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#edf0f6]">
                  <div className="h-full rounded-full bg-[#FD7124]" style={{ width: `${Number(value) * 2}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <SmallButton filled>Approve Assignment</SmallButton>
            <SmallButton>Choose Different Worker</SmallButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkerCard({ worker }: { worker: (typeof workerColumns)[number]['workers'][number] }) {
  return (
    <button className="w-full rounded-md border border-[#edf0f6] bg-white p-3 text-left shadow-[0_8px_24px_rgba(36,45,73,0.04)]">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#FFEFE6] text-xs font-bold text-[#FD7124]">{worker.name.slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-black">{worker.name}</p>
          <p className="truncate text-xs text-[#8d93a3]">{worker.task}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <span className="rounded bg-[#F7F8FC] px-2 py-1 text-[#6f7382]">Time {worker.time}</span>
        <span className="rounded bg-[#F7F8FC] px-2 py-1 text-[#6f7382]">{worker.workload}</span>
        <span className="rounded bg-[#FFEFE6] px-2 py-1 text-[#FD7124]">Fatigue {worker.fatigue}</span>
        <span className="rounded bg-[#edf9f1] px-2 py-1 text-[#20a55a]">{worker.pay}</span>
      </div>
    </button>
  );
}

function ManagerDashboard({ onNavigate }: { onNavigate: (route: RouteName) => void }) {
  return (
    <section className="min-w-0 flex-1 bg-white">
      <header className="flex h-[64px] items-center border-b border-[#e8ebf3] px-5 sm:px-8">
        <div className="hidden h-9 w-full max-w-[560px] items-center rounded-md bg-[#f7f8fc] px-4 text-[#b6bdcd] sm:flex">
          <span className="text-sm">Search workers, tasks, reports</span>
          <Search size={16} className="ml-auto" />
        </div>
        <div className="ml-auto flex items-center gap-5">
          <SmallButton><Plus size={13} className="mr-1 inline" />Create Task</SmallButton>
          <RouteLink to="worker" onNavigate={onNavigate}>Worker Route</RouteLink>
          <button className="relative text-[#aab1c2]">
            <Bell size={17} />
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#EF4E5C]" />
          </button>
          <button className="flex items-center gap-3 text-sm font-semibold text-[#4c5367]">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#FFEFE6] text-[#FD7124]">PM</span>
            Project Manager
            <ChevronDown size={14} className="text-[#9ca3b5]" />
          </button>
        </div>
      </header>

      <div className="px-5 py-8 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-normal">Manager Dashboard</h1>
            <p className="mt-2 text-sm text-[#8d93a3]">Automated workforce assignment, safety status, and task review.</p>
          </div>
          <div className="flex gap-2">
            <SmallButton><Filter size={13} className="mr-1 inline" />Filter</SmallButton>
            <SmallButton filled>Assign Automatically</SmallButton>
          </div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {kpis.map((item) => <KpiCard key={item.label} {...item} />)}
        </div>

        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <AiAssignmentPanel />

            <section className="rounded-lg border border-[#e8ebf3] bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-black">Worker Board</p>
                  <p className="mt-2 text-sm text-[#8d93a3]">Kanban view with workload, fatigue, and earnings.</p>
                </div>
                <SmallButton>View All</SmallButton>
              </div>
              <div className="mt-5 grid gap-4 xl:grid-cols-4">
                {workerColumns.map((column) => (
                  <div key={column.title} className="rounded-lg bg-[#F7F8FC] p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold text-[#4c5367]">{column.title}</p>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: column.color }} />
                    </div>
                    <div className="space-y-3">
                      {column.workers.map((worker) => <WorkerCard key={worker.name} worker={worker} />)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-[#e8ebf3] bg-white p-5">
              <p className="text-sm font-semibold text-black">Task Board</p>
              <div className="mt-5 grid gap-3 xl:grid-cols-5">
                {taskColumns.map((column) => (
                  <div key={column.title} className="rounded-lg border border-[#edf0f6] p-3">
                    <p className="mb-3 text-xs font-bold text-[#8d93a3]">{column.title}</p>
                    <div className="space-y-2">
                      {column.tasks.map((task, index) => (
                        <div key={task} className="rounded-md bg-[#F7F8FC] p-3">
                          <p className="text-sm font-semibold text-black">{task}</p>
                          <p className="mt-2 text-xs text-[#8d93a3]">ETA {index + 1}h 20m</p>
                          <div className="mt-3 h-1.5 rounded-full bg-[#e7eaf3]">
                            <div className="h-full rounded-full bg-[#FD7124]" style={{ width: `${45 + index * 18}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-lg border border-[#e8ebf3] bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-black">Task Completion Chart</p>
                  <p className="mt-2 text-sm text-[#8d93a3]">Last 12 days</p>
                </div>
                <SmallButton>Report</SmallButton>
              </div>
              <CompletionChart />
            </section>

            <section className="rounded-lg border border-[#e8ebf3] bg-white p-5">
              <p className="text-sm font-semibold text-black">Worker Status Summary</p>
              <StatusDonut />
              <div className="grid grid-cols-3 gap-2 text-center text-xs text-[#6f7382]">
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#ff9f33]" />Working<br /><b>58%</b></span>
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#7D7AE8]" />Break<br /><b>17%</b></span>
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#cbd2ff]" />Waiting<br /><b>25%</b></span>
              </div>
            </section>

            <section className="rounded-lg border border-[#e8ebf3] bg-white p-5">
              <p className="text-sm font-semibold text-black">Recent Notifications</p>
              <div className="mt-4 space-y-3">
                {notifications.map((item) => (
                  <div key={item.title} className="rounded-md border border-[#edf0f6] bg-[#F7F8FC] p-3">
                    <p className="text-sm font-bold text-black">{item.title}</p>
                    <p className="mt-1 text-xs text-[#8d93a3]">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-[#e8ebf3] bg-white p-5">
              <p className="text-sm font-semibold text-black">Task Review</p>
              <div className="mt-4 rounded-md bg-[#F7F8FC] p-3">
                <div className="h-28 rounded-md bg-gradient-to-br from-[#FFEFE6] to-[#F1F2F7]" />
                <p className="mt-3 text-sm font-bold text-black">Dimas - Scaffold inspection</p>
                <p className="mt-1 text-xs text-[#8d93a3]">Photo uploaded. Notes: loose board replaced.</p>
                <div className="mt-4 flex gap-2">
                  <SmallButton filled>Approve</SmallButton>
                  <SmallButton>Request Revision</SmallButton>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}

function ProcedureStep({ index, icon: Icon, label }: { index: number; icon: typeof HardHat; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-white p-3">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#FFEFE6] text-xs font-bold text-[#FD7124]">{index}</span>
      <Icon size={17} className="text-[#252d45]" />
      <span className="text-sm font-semibold text-[#252d45]">{label}</span>
    </div>
  );
}

function WorkerRoute({ onNavigate }: { onNavigate: (route: RouteName) => void }) {
  return (
    <section className="min-h-screen w-full bg-[#F1F2F7] px-4 py-6">
      <div className="mx-auto mb-5 flex max-w-[430px] items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#FD7124] text-white"><HardHat size={17} /></span>
          <div>
            <p className="text-xs font-bold text-[#FD7124]">GARUDIE WORKER</p>
            <p className="text-xs text-[#8d93a3]">Mobile field workflow</p>
          </div>
        </div>
        <RouteLink to="manager" onNavigate={onNavigate}>Manager</RouteLink>
      </div>

      <div className="relative mx-auto max-w-[430px] rounded-[34px] bg-[#171b2c] p-3 shadow-[0_30px_80px_rgba(36,45,73,0.18)]">
        <div className="rounded-[26px] bg-[#F7F8FC] p-4">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#8d93a3]">Good morning,</p>
              <h2 className="text-xl font-bold text-black">Budi Santoso</h2>
              <p className="mt-1 text-xs text-[#8d93a3]">Garuda Tower - Zone C</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#FFEFE6] text-[#FD7124]"><HardHat size={18} /></span>
          </header>

          <section className="mt-5 rounded-2xl bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-[#8d93a3]">Current Assignment</p>
                <h3 className="mt-2 text-lg font-bold text-black">Steel Installation</h3>
                <p className="mt-1 text-xs text-[#8d93a3]">Garuda Tower - Zone C</p>
              </div>
              <span className="rounded-full bg-[#FFEFE6] px-3 py-1 text-xs font-bold text-[#FD7124]">High</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <span className="rounded-md bg-[#F7F8FC] p-2"><b>2h 15m</b><br />Duration</span>
              <span className="rounded-md bg-[#F7F8FC] p-2"><b>Zone C</b><br />Area</span>
              <span className="rounded-md bg-[#fff0f2] p-2 text-[#dc344c]"><b>Risk</b><br />Medium</span>
            </div>
            <button className="mt-4 w-full rounded-xl bg-[#FD7124] py-4 text-sm font-bold text-white">Start Task</button>
          </section>

          <section className="mt-4 grid grid-cols-[130px_minmax(0,1fr)] gap-3">
            <div className="rounded-2xl bg-white p-4">
              <div className="relative mx-auto h-24 w-24">
                <svg viewBox="0 0 100 100" className="-rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#edf0f6" strokeWidth="10" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#FD7124" strokeWidth="10" strokeDasharray="180 251" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                  <p className="text-lg font-bold text-black">42m</p>
                  <p className="text-[10px] text-[#8d93a3]">break</p>
                </div>
              </div>
              <p className="mt-2 text-center text-xs font-bold text-[#20B15A]">Working</p>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p className="text-xs font-semibold text-[#8d93a3]">Working Status</p>
              <div className="mt-3 space-y-2 text-xs text-[#6f7382]">
                <p className="flex justify-between"><span>Start Time</span><b>08:10</b></p>
                <p className="flex justify-between"><span>Duration</span><b>2h 08m</b></p>
                <p className="flex justify-between"><span>Next Break</span><b>42m</b></p>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-2xl bg-white p-4">
            <p className="text-xs font-semibold text-[#8d93a3]">Estimated Earnings</p>
            <p className="mt-2 text-2xl font-bold text-black">Rp180.000</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <span className="rounded-md bg-[#F7F8FC] p-2">Current<br /><b>+Rp35k</b></span>
              <span className="rounded-md bg-[#F7F8FC] p-2">Bonus<br /><b>+Rp15k</b></span>
              <span className="rounded-md bg-[#edf9f1] p-2 text-[#20a55a]">Total<br /><b>Rp265k</b></span>
            </div>
          </section>

          <section className="mt-4 rounded-2xl bg-[#FFEFE6] p-4">
            <p className="text-sm font-bold text-black">Steel Installation Procedure</p>
            <div className="mt-3 space-y-2">
              <ProcedureStep index={1} icon={HardHat} label="Wear Helmet" />
              <ProcedureStep index={2} icon={ShieldCheck} label="Attach Harness" />
              <ProcedureStep index={3} icon={MapPin} label="Secure Anchor" />
              <ProcedureStep index={4} icon={Cone} label="Install Steel Beam" />
            </div>
          </section>

          <section className="mt-4 rounded-2xl bg-white p-4">
            <p className="text-sm font-bold text-black">Safety Precautions</p>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px] font-semibold text-[#6f7382]">
              {[HardHat, ShieldCheck, BriefcaseBusiness, Wind].map((Icon, index) => (
                <span key={index} className="rounded-md bg-[#F7F8FC] p-2"><Icon size={16} className="mx-auto mb-1 text-[#FD7124]" />{['Helmet', 'Harness', 'Boots', 'High Wind'][index]}</span>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-2xl bg-white p-4">
            <p className="text-sm font-bold text-black">Report Hazard</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-semibold text-[#6f7382]">
              {['Missing PPE', 'Wet Floor', 'Equipment', 'Scaffold', 'Other'].map((item) => (
                <button key={item} className="rounded-md bg-[#F7F8FC] p-2">{item}</button>
              ))}
            </div>
          </section>

          <button className="mt-4 w-full rounded-xl bg-[#252d45] py-4 text-sm font-bold text-white">Complete Assignment</button>

          <nav className="mt-4 grid grid-cols-4 rounded-2xl bg-white p-2">
            {workerNav.map(({ label, icon: Icon, active }) => (
              <button key={label} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold ${active ? 'bg-[#FFEFE6] text-[#FD7124]' : 'text-[#a5acbd]'}`}>
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>
        <button className="absolute bottom-8 right-8 grid h-14 w-14 place-items-center rounded-full bg-[#EF4E5C] text-white shadow-[0_18px_36px_rgba(239,78,92,0.35)]">
          <PhoneCall size={20} />
        </button>
      </div>
    </section>
  );
}

function ManagerRoute({ onNavigate }: { onNavigate: (route: RouteName) => void }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-[230px] shrink-0 bg-[#f2f4fa] px-6 py-7 lg:block">
        <div className="mb-12 flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#FD7124] text-white"><HardHat size={16} /></span>
          <span className="text-xs font-extrabold tracking-normal text-[#FD7124]">GARUDIE</span>
        </div>

        <p className="mb-3 text-[11px] font-semibold uppercase text-[#a7adbd]">Manager</p>
        <nav className="space-y-2">
          {managerMenu.map(({ label, icon: Icon, active }) => (
            <button key={label} className={`flex w-full items-center gap-4 rounded-md px-4 py-3 text-left text-sm ${active ? 'bg-[#FFEFE6] font-semibold text-[#FD7124]' : 'text-[#9aa1b4]'}`}>
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        <p className="mb-3 mt-9 text-[11px] font-semibold uppercase text-[#a7adbd]">Platform</p>
        <nav className="space-y-2">
          {[
            { label: 'Assignment Logic', icon: Sparkles },
            { label: 'Payroll', icon: WalletCards },
            { label: 'Safety Rules', icon: ShieldCheck },
            { label: 'Worker App', icon: User, route: 'worker' as const },
            { label: 'Help', icon: HelpCircle },
            { label: 'Settings', icon: Settings }
          ].map(({ label, icon: Icon, route }) => (
            <a
              key={label}
              href={route ? `/${route}` : '#'}
              onClick={(event) => {
                if (!route) return;
                event.preventDefault();
                onNavigate(route);
              }}
              className="flex w-full items-center gap-4 rounded-md px-4 py-3 text-left text-sm text-[#9aa1b4]"
            >
              <Icon size={17} />
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <ManagerDashboard onNavigate={onNavigate} />
    </div>
  );
}

function App() {
  const [route, setRoute] = useState<RouteName>(getRouteFromPath);

  useEffect(() => {
    const handlePopState = () => setRoute(getRouteFromPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (nextRoute: RouteName) => {
    window.history.pushState({}, '', `/${nextRoute}`);
    setRoute(nextRoute);
  };

  return (
    <main className="min-h-screen bg-[#F1F2F7] font-sans text-[#252d45]">
      {route === 'worker' ? <WorkerRoute onNavigate={navigate} /> : <ManagerRoute onNavigate={navigate} />}
    </main>
  );
}

export default App;
