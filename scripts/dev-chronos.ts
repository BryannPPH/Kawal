import { existsSync } from 'node:fs';
import { join } from 'node:path';

const candidates = [
  join(process.cwd(), '.venv', 'bin', 'python.exe'),
  join(process.cwd(), '.venv', 'Scripts', 'python.exe'),
  'python'
];

const python = candidates.find((candidate) => candidate === 'python' || existsSync(candidate)) ?? 'python';

const child = Bun.spawn([
  python,
  '-m',
  'uvicorn',
  'services.chronos_api.main:app',
  '--host',
  '127.0.0.1',
  '--port',
  '8001'
], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit'
});

process.on('SIGINT', () => {
  child.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  child.kill();
  process.exit(0);
});

process.exit(await child.exited);
