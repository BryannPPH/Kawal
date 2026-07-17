const apiUrl = 'http://127.0.0.1:3001/api/health';
const children: ReturnType<typeof Bun.spawn>[] = [];

const apiProcess = spawn(['bun', 'run', 'dev:api']);
children.push(apiProcess);

const apiReady = await waitForApi();

if (!apiReady) {
  stopChildren();
  process.exit(1);
}

const frontendProcess = spawn(['bun', 'run', 'dev:frontend']);
children.push(frontendProcess);

function spawn(command: string[]) {
  return Bun.spawn(command, {
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit'
  });
}

async function waitForApi() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (apiProcess.exitCode !== null) {
      return false;
    }

    try {
      const response = await fetch(apiUrl);

      if (response.ok) {
        return true;
      }
    } catch {
      // API is still starting.
    }

    await Bun.sleep(150);
  }

  console.error('API did not become ready on http://127.0.0.1:3001. Stop the process using that port and retry.');
  return false;
}

function stopChildren() {
  for (const child of children) {
    child.kill();
  }
}

process.on('SIGINT', () => {
  stopChildren();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopChildren();
  process.exit(0);
});

await Promise.race(children.map((child) => child.exited));
stopChildren();
