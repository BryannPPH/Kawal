import { ClipboardList, HardHat, LayoutDashboard, TimerReset, Users, WalletCards } from 'lucide-react';

const managerMenu = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Workers', icon: Users },
  { label: 'Tasks', icon: ClipboardList },
  { label: 'Payroll', icon: WalletCards }
];

export function ManagerSidebar() {
  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-[#F3D7C8] bg-white px-5 py-6 lg:block">
      <div className="mb-10 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#FD7124] text-white">
          <HardHat size={17} />
        </span>
        <div>
          <p className="text-sm font-bold text-[#2F2C2A]">GARUDIE</p>
          <p className="text-xs text-[#776B63]">Workforce OS</p>
        </div>
      </div>

      <nav className="space-y-1">
        {managerMenu.map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            type="button"
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold ${
              active ? 'bg-[#FD7124] text-white' : 'text-[#776B63] hover:bg-[#FFEFE6] hover:text-[#2F2C2A]'
            }`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-8 rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] p-4">
        <p className="text-sm font-semibold text-[#2F2C2A]">Shift Health</p>
        <div className="mt-3 flex items-center gap-2">
          <TimerReset size={16} className="text-[#FAA745]" />
          <p className="text-sm text-[#776B63]">11 workers scheduled for break.</p>
        </div>
      </div>
    </aside>
  );
}
