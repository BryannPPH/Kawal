import { useEffect, useState } from 'react';
import { notifications as fallbackNotifications, tasks as fallbackTasks, workers as fallbackWorkers } from '../constants/workforce';
import type { Notification, Task, WorkforceData } from '../types/workforce';

export type WorkerRestRecommendation = {
  workerId: string;
  recommendedMinutes: number;
  fatigueScore: number;
  fatigueLevel: string;
  chronosStatus: 'READY' | 'UNAVAILABLE';
  reason: string;
};

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
    notes?: string;
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

  const autoAssignTask = async (taskId: string) => {
    const response = await fetch(`/api/tasks/${taskId}/auto-assign`, { method: 'PATCH' });
    const payload = (await response.json()) as Task | { error?: string };

    if (!response.ok || isTaskError(payload)) {
      throw new Error('error' in payload ? payload.error ?? 'Unable to assign task' : 'Unable to assign task');
    }

    try {
      const workforceResponse = await fetch('/api/workforce');

      if (!workforceResponse.ok) {
        throw new Error(`API returned ${workforceResponse.status}`);
      }

      setData((await workforceResponse.json()) as WorkforceData);
    } catch {
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((task) => task.id === payload.id ? payload : task)
      }));
    }

    return payload;
  };

  const reviewTaskCompletion = async (taskId: string, decision: 'accept' | 'reject', note?: string) => {
    const response = await fetch(`/api/tasks/${taskId}/review/${decision}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note })
    });
    const payload = (await response.json()) as Task | { error?: string };

    if (!response.ok || isTaskError(payload)) {
      throw new Error('error' in payload ? payload.error ?? 'Unable to review task' : 'Unable to review task');
    }

    try {
      const workforceResponse = await fetch('/api/workforce');

      if (!workforceResponse.ok) {
        throw new Error(`API returned ${workforceResponse.status}`);
      }

      setData((await workforceResponse.json()) as WorkforceData);
    } catch {
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((task) => task.id === payload.id ? payload : task)
      }));
    }

    return payload;
  };

  const getWorkerRestRecommendation = async (workerId: string) => {
    const response = await fetch(`/api/workers/${workerId}/rest-recommendation`);
    const payload = (await response.json()) as WorkerRestRecommendation | { error?: string };

    if (!response.ok || isRestRecommendationError(payload)) {
      throw new Error('error' in payload ? payload.error ?? 'Unable to recommend rest' : 'Unable to recommend rest');
    }

    return payload;
  };

  const grantWorkerRest = async (workerId: string, minutes?: number) => {
    const response = await fetch(`/api/workers/${workerId}/rest-grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ minutes })
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok || payload.error) {
      throw new Error(payload.error ?? 'Unable to grant rest');
    }

    const workforceResponse = await fetch('/api/workforce');

    if (workforceResponse.ok) {
      setData((await workforceResponse.json()) as WorkforceData);
    }
  };

  return {
    ...data,
    loading,
    error,
    markNotificationRead,
    createTask,
    autoAssignTask,
    reviewTaskCompletion,
    getWorkerRestRecommendation,
    grantWorkerRest
  };
}

function isTaskError(payload: Task | { error?: string }): payload is { error?: string } {
  return 'error' in payload;
}

function isRestRecommendationError(payload: WorkerRestRecommendation | { error?: string }): payload is { error?: string } {
  return 'error' in payload;
}
