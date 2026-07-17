import type { Notification } from '../types/workforce';

export function sortNotificationsNewestFirst(notifications: Notification[]) {
  return notifications.slice().sort((left, right) => getNotificationTimestamp(right) - getNotificationTimestamp(left));
}

export function formatNotificationRelativeTime(createdAt?: string) {
  const timestamp = createdAt ? new Date(createdAt).getTime() : Number.NaN;

  if (!Number.isFinite(timestamp)) {
    return 'Baru saja';
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return 'Baru saja';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} menit lalu`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} jam lalu`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} hari lalu`;
}

function getNotificationTimestamp(notification: Notification) {
  const timestamp = notification.createdAt ? new Date(notification.createdAt).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}
