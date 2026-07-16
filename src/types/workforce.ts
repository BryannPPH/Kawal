export type WorkerStatus = 'waiting' | 'working' | 'break' | 'done';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger';

export type Worker = {
  id: string;
  name: string;
  role: string;
  task: string;
  status: WorkerStatus;
  zone: string;
  time: string;
  workload: string;
  fatigue: number;
  pay: string;
  match: number;
};

export type Task = {
  title: string;
  owner: string;
  status: string;
  due: string;
  tone: Tone;
};

export type Notification = {
  title: string;
  detail: string;
  tone: Tone;
};
