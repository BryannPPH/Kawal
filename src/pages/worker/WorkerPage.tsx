import {
  BriefcaseBusiness,
  ClipboardCheck,
  HardHat,
  Home,
  MapPin,
  MessageSquareWarning,
  PhoneCall,
  ShieldCheck,
  User
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { RouteLink } from '../../components/ui/RouteLink';
import type { RouteName } from '../../types/navigation';
import { ProcedureStep } from './components/ProcedureStep';

type WorkerPageProps = {
  onNavigate: (route: RouteName) => void;
};

const workerNav = [
  { label: 'Home', icon: Home, active: true },
  { label: 'Tasks', icon: ClipboardCheck },
  { label: 'Report', icon: MessageSquareWarning },
  { label: 'Profile', icon: User }
];

export function WorkerPage({ onNavigate }: WorkerPageProps) {
  const [started, setStarted] = useState(false);
  const [hazard, setHazard] = useState<string | null>(null);
  const [sosSent, setSosSent] = useState(false);

  return (
    <section className="min-h-screen bg-[#F1F2F7] px-4 py-6">
      <div className="mx-auto flex max-w-[430px] items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#FD7124] text-white">
            <HardHat size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">Budi Santoso</p>
            <p className="text-xs text-[#776B63]">Zone C · Steel Crew</p>
          </div>
        </div>
        <RouteLink to="manager" onNavigate={onNavigate}>Manager</RouteLink>
      </div>

      <div className="relative mx-auto mt-5 max-w-[430px] rounded-lg border border-[#F3D7C8] bg-white p-4 shadow-[0_20px_60px_rgba(76,48,35,0.14)]">
        <section className="rounded-lg bg-[#FD7124] p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white/70">Current Assignment</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-normal">Steel Installation</h1>
              <p className="mt-2 text-sm text-white/85">Garuda Tower · Zone C</p>
            </div>
            <Pill className="bg-white/20 text-white">Medium Risk</Pill>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-white/70">Duration</p>
              <p className="mt-1 font-semibold">2h 15m</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-white/70">Break</p>
              <p className="mt-1 font-semibold">42m</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-white/70">Earning</p>
              <p className="mt-1 font-semibold">Rp180k</p>
            </div>
          </div>
          <Button variant="primary" onClick={() => setStarted((value) => !value)} className="mt-5 w-full bg-white text-[#C95119] hover:bg-[#FFEFE6]">
            {started ? 'Pause Task' : 'Start Task'}
          </Button>
        </section>

        <section className="mt-4">
          <p className="mb-3 text-sm font-semibold text-[#2F2C2A]">Safety Checklist</p>
          <ul className="space-y-2">
            <ProcedureStep done={started} icon={HardHat} label="Wear helmet and boots" />
            <ProcedureStep done={started} icon={ShieldCheck} label="Attach harness to anchor point" />
            <ProcedureStep done={false} icon={MapPin} label="Confirm work area is barricaded" />
            <ProcedureStep done={false} icon={BriefcaseBusiness} label="Submit completion photo" />
          </ul>
        </section>

        <section className="mt-4 rounded-lg border border-[#F3D7C8] p-4">
          <p className="text-sm font-semibold text-[#2F2C2A]">Report Hazard</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {['Missing PPE', 'Wet Floor', 'Equipment', 'Scaffold'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setHazard(item)}
                className={`h-10 rounded-md border text-sm font-semibold ${
                  hazard === item ? 'border-[#FD7124] bg-[#FFEFE6] text-[#B84011]' : 'border-[#F3D7C8] bg-white text-[#5F5A56]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {hazard ? <p className="mt-3 text-sm font-medium text-[#B84011]">{hazard} report queued for supervisor review.</p> : null}
        </section>

        <div className="mt-4 grid grid-cols-[1fr_56px] gap-3">
          <Button variant={started ? 'primary' : 'secondary'} className="h-12">
            {started ? 'Complete Assignment' : 'Ready for Work'}
          </Button>
          <button
            type="button"
            aria-label="Call supervisor"
            title="Call supervisor"
            onClick={() => setSosSent(true)}
            className="grid h-12 w-14 place-items-center rounded-md bg-[#B84011] text-white"
          >
            <PhoneCall size={19} />
          </button>
        </div>
        {sosSent ? <p className="mt-3 text-center text-sm font-semibold text-[#B84011]">Supervisor call requested.</p> : null}

        <nav className="mt-4 grid grid-cols-4 rounded-lg border border-[#F3D7C8] bg-white p-1">
          {workerNav.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              type="button"
              className={`flex flex-col items-center gap-1 rounded-md py-2 text-[11px] font-semibold ${
                active ? 'bg-[#FD7124] text-white' : 'text-[#776B63] hover:bg-[#FFEFE6]'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}
