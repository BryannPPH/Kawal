import { TimerReset } from 'lucide-react';
import kawalLogo from '../../../assets/kawal-logo.svg';
import { managerSections } from '../../../constants/managerNavigation';
import type { ManagerSection } from '../../../types/navigation';

type ManagerSidebarProps = {
  activeSection: ManagerSection;
  onSelectSection: (section: ManagerSection) => void;
};

export function ManagerSidebar({ activeSection, onSelectSection }: ManagerSidebarProps) {
  const activeLabel = managerSections.find((item) => item.section === activeSection)?.label ?? 'Dashboard';

  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-[#F3D7C8] bg-white px-5 py-6 lg:flex lg:flex-col">
      <div>
        <div className="mb-10 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center">
            <img src={kawalLogo} alt="Kawal logo" className="h-10 w-10 object-contain" />
          </span>
          <div>
            <p className="text-2xl font-bold leading-none text-[#2F2C2A]">Kawal</p>
          </div>
        </div>

        <nav className="space-y-1" aria-label="Manager navigation">
          {managerSections.map(({ label, section, icon: Icon }) => {
            const active = section === activeSection;

            return (
              <button
                key={section}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelectSection(section)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold ${
                  active ? 'bg-[#FD7124] text-white' : 'text-[#776B63] hover:bg-[#FFEFE6] hover:text-[#2F2C2A]'
                }`}
              >
                <Icon size={17} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-8 rounded-lg border border-[#F3D7C8] bg-[#FFF8F4] p-4">
        <p className="text-sm font-semibold text-[#2F2C2A]">Current Page</p>
        <p className="mt-1 text-sm text-[#776B63]">{activeLabel}</p>
        <div className="mt-4 flex items-center gap-2">
          <TimerReset size={16} className="text-[#FAA745]" />
          <p className="text-sm text-[#776B63]">11 workers scheduled for break.</p>
        </div>
      </div>
    </aside>
  );
}
