import { Bell } from 'lucide-react';
import { notifications } from '../../../constants/workforce';

export function AlertPanel() {
  return (
    <section className="rounded-lg border border-[#F3D7C8] bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Bell size={17} className="text-[#FD7124]" />
        <p className="text-sm font-semibold text-[#2F2C2A]">Priority Alerts</p>
      </div>
      <div className="space-y-3">
        {notifications.map((item) => (
          <div key={item.title} className="rounded-lg border border-[#F3D7C8] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#2F2C2A]">{item.title}</p>
              <span className={`h-2.5 w-2.5 rounded-full ${item.tone === 'danger' ? 'bg-[#FD7124]' : item.tone === 'warning' ? 'bg-[#FAA745]' : 'bg-[#C95119]'}`} />
            </div>
            <p className="mt-1 text-sm text-[#776B63]">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
