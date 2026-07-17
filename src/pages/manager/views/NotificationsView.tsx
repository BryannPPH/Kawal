import { AlertTriangle, Bell, CheckCircle2, CircleDot, ExternalLink } from 'lucide-react';
import { Pill } from '../../../components/ui/Pill';
import { toneStyles } from '../../../constants/workforce';
import { formatNotificationRelativeTime, sortNotificationsNewestFirst } from '../../../lib/notificationTime';
import type { Notification } from '../../../types/workforce';

type NotificationsViewProps = {
  notifications: Notification[];
  unreadCount: number;
  onOpenNotification: (notification: Notification) => void;
};

export function NotificationsView({ notifications, unreadCount, onOpenNotification }: NotificationsViewProps) {
  const sortedNotifications = sortNotificationsNewestFirst(notifications);
  const dangerCount = notifications.filter((notification) => notification.tone === 'danger').length;
  const warningCount = notifications.filter((notification) => notification.tone === 'warning').length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#F3D7C8] bg-white/85 p-5 shadow-[0_18px_50px_rgba(76,48,35,0.08)] backdrop-blur">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard icon={Bell} label="Unread" value={String(unreadCount)} />
          <SummaryCard icon={AlertTriangle} label="Critical" value={String(dangerCount)} />
          <SummaryCard icon={CircleDot} label="Warnings" value={String(warningCount)} />
        </div>
      </section>

      <section className="rounded-2xl border border-[#F3D7C8] bg-white/88 p-5 shadow-[0_18px_50px_rgba(76,48,35,0.08)] backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2F2C2A]">All Notifications</p>
            <p className="mt-1 text-sm text-[#776B63]">Open an item to jump to the related worker, task, IoT panel, or incident.</p>
          </div>
          <Pill className="bg-[#FFEFE6] text-[#C95119]">{notifications.length} total</Pill>
        </div>

        <div className="mt-5 space-y-3">
          {sortedNotifications.length ? (
            sortedNotifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => onOpenNotification(notification)}
                className={`group grid w-full gap-3 rounded-2xl border p-4 text-left transition hover:border-[#FD7124] hover:bg-[#FFEFE6] sm:grid-cols-[1fr_auto] sm:items-center ${
                  notification.read ? 'border-[#F3D7C8] bg-white/80' : 'border-[#F3D7C8] bg-[#FFF8F4]'
                }`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    {notification.read ? <CheckCircle2 size={16} className="text-[#A09188]" /> : <Bell size={16} className="text-[#FD7124]" />}
                    <span className="truncate text-sm font-semibold text-[#2F2C2A]">{notification.title}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${notification.read ? 'bg-[#D9C5B9]' : notification.tone === 'danger' ? 'bg-[#FD7124]' : notification.tone === 'warning' ? 'bg-[#FAA745]' : 'bg-[#C95119]'}`} />
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-[#776B63]">{notification.detail}</span>
                  <span className="mt-2 block text-xs font-semibold text-[#A09188]">{formatNotificationRelativeTime(notification.createdAt)}</span>
                </span>
                <span className="flex items-center justify-between gap-3 sm:justify-end">
                  <Pill className={toneStyles[notification.tone]}>{notification.targetSection}</Pill>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#C95119]">
                    {notification.targetLabel}
                    <ExternalLink size={14} />
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="rounded-2xl bg-[#FFF8F4] px-4 py-6 text-sm font-semibold text-[#776B63]">No notifications yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#F3D7C8] bg-[#FFF8F4] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-[#A09188]">{label}</p>
        <Icon size={17} className="text-[#FD7124]" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#2F2C2A]">{value}</p>
    </div>
  );
}
