import { useEffect, useState } from 'react';
import { notifications as fallbackNotifications, tasks as fallbackTasks, workers as fallbackWorkers } from '../constants/workforce';
import type { Notification, Task, WorkforceData } from '../types/workforce';

const fallbackData: WorkforceData = {
  workers: fallbackWorkers,
  tasks: fallbackTasks,
  notifications: fallbackNotifications
};

export function useWorkforceData() {
  const [data, setData] = useState<WorkforceData>(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkforceData() {
      try {
        const response = await fetch('/api/workforce');

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const nextData = (await response.json()) as WorkforceData;

        if (!cancelled) {
          setData(nextData);
          setError(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setData(fallbackData);
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load workforce data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWorkforceData();
    const timer = window.setInterval(loadWorkforceData, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const markNotificationRead = async (notificationId: string) => {
    setData((current) => ({
      ...current,
      notifications: current.notifications.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      )
    }));

    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH'
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const updatedNotification = (await response.json()) as Notification;

      setData((current) => ({
        ...current,
        notifications: current.notifications.map((notification) =>
          notification.id === notificationId ? updatedNotification : notification
        )
      }));
    } catch {
      // Keep the optimistic local state so the UI remains responsive during offline demos.
    }
  };

  const createTask = async (input: {
    taskTemplate: string;
    project: string;
    zone: string;
    quantity: number;
    unit: string;
    deadline: string;
    priority: string;
    temperatureC?: number | null;
    humidityPct?: number | null;
    workload: string;
    notes?: string;
    owner?: string;
  }) => {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    });

    const payload = (await response.json()) as Task | { error?: string };

    if (!response.ok || isTaskError(payload)) {
      throw new Error('error' in payload ? payload.error ?? 'Unable to create task' : 'Unable to create task');
    }

    const createdTask = payload;

    setData((current) => ({
      ...current,
      tasks: [...current.tasks, createdTask]
    }));

    return createdTask;
  };

  return {
    ...data,
    loading,
    error,
    markNotificationRead,
    createTask
  };
}

function isTaskError(payload: Task | { error?: string }): payload is { error?: string } {
  return 'error' in payload;
}
