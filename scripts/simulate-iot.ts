const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';
const deviceId = process.env.SIM_DEVICE_ID ?? 'device-001';
const workerId = process.env.SIM_WORKER_ID ?? 'budi';
const siteId = process.env.SIM_SITE_ID ?? 'site-001';
const zoneId = process.env.SIM_ZONE_ID ?? 'Zone C';
const taskId = process.env.SIM_TASK_ID ?? 'steel-beam-install';

const command = process.argv[2] ?? 'normal-shift';

const topic = (suffix: string) => `construction/v1/devices/${deviceId}/${suffix}`;

function envelope(eventType: string, payload: Record<string, unknown>) {
  return {
    schemaVersion: '1.0',
    messageId: crypto.randomUUID(),
    deviceId,
    workerId,
    siteId,
    zoneId,
    taskId,
    eventType,
    recordedAt: new Date().toISOString(),
    sequenceNumber: Math.floor(Date.now() / 1000),
    firmwareVersion: '0.1.0',
    payload
  };
}

const scenarios: Record<string, Array<{ topic: string; payload: unknown }>> = {
  'normal-shift': [
    {
      topic: topic('status/heartbeat'),
      payload: envelope('HEARTBEAT', {
        batteryPct: 82,
        signalStrength: -61,
        uptimeSeconds: 8200,
        currentFirmwareVersion: '0.1.0'
      })
    },
    {
      topic: topic('telemetry/environment'),
      payload: envelope('ENVIRONMENT_TELEMETRY', {
        temperatureC: 30.2,
        humidityPct: 68,
        weather: 'CLEAR',
        surfaceCondition: 'DRY',
        craneActive: false,
        restrictedZoneDetected: false,
        batteryPct: 82,
        signalStrength: -61
      })
    },
    {
      topic: topic('telemetry/motion'),
      payload: envelope('MOTION_TELEMETRY', {
        accelerationX: 0.12,
        accelerationY: 0.18,
        accelerationZ: 1.08,
        peakAccelerationG: 1.92,
        tiltDegrees: 42,
        tiltChangeDegrees: 15,
        movementState: 'MOVING',
        inactiveSeconds: 0,
        impactDetected: false,
        fallCandidate: false,
        batteryPct: 81
      })
    }
  ],
  'high-temperature': [
    {
      topic: topic('telemetry/environment'),
      payload: envelope('ENVIRONMENT_TELEMETRY', {
        temperatureC: 35.5,
        humidityPct: 72,
        weather: 'HOT',
        surfaceCondition: 'WET',
        craneActive: true,
        restrictedZoneDetected: false,
        batteryPct: 76,
        signalStrength: -64
      })
    }
  ],
  'rest-button': [
    {
      topic: topic('events/rest-request'),
      payload: envelope('REST_BUTTON_PRESSED', {
        buttonPressDurationMs: 800,
        reasonCode: 'WORKER_REQUEST',
        batteryPct: 80
      })
    }
  ],
  'sos-button': [
    {
      topic: topic('events/sos'),
      payload: envelope('SOS_BUTTON_PRESSED', {
        buttonPressDurationMs: 1500,
        batteryPct: 81
      })
    }
  ],
  'fall-candidate': [
    {
      topic: topic('telemetry/motion'),
      payload: envelope('MOTION_TELEMETRY', {
        accelerationX: 1.2,
        accelerationY: 0.8,
        accelerationZ: 2.2,
        peakAccelerationG: 6.8,
        tiltDegrees: 82,
        tiltChangeDegrees: 62,
        movementState: 'FALL_CANDIDATE',
        inactiveSeconds: 18,
        impactDetected: true,
        fallCandidate: true,
        batteryPct: 79
      })
    }
  ],
  'offline-device': [
    {
      topic: topic('status/connection'),
      payload: envelope('CONNECTION_STATUS', {
        status: 'OFFLINE',
        reason: 'SIMULATED_DISCONNECT'
      })
    }
  ]
};

async function main() {
  if (command === 'reset') {
    const process = Bun.spawn(['bun', 'run', 'db:seed'], {
      stdout: 'inherit',
      stderr: 'inherit'
    });
    const exitCode = await process.exited;
    process.exit(exitCode);
  }

  if (command === 'buzzer-success' || command === 'buzzer-failure') {
    await simulateCommandResult(command === 'buzzer-success');
    return;
  }

  const messages = scenarios[command];

  if (!messages) {
    console.error(`Unknown simulation "${command}".`);
    console.error(`Available: ${Object.keys(scenarios).join(', ')}, buzzer-success, buzzer-failure, reset`);
    process.exit(1);
  }

  for (const message of messages) {
    const response = await fetch(`${apiBaseUrl}/api/dev/iot/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    const body = await response.json();
    console.log(`${message.topic}: ${response.status}`);
    console.log(JSON.stringify(body, null, 2));
  }
}

async function simulateCommandResult(succeeded: boolean) {
  const overviewResponse = await fetch(`${apiBaseUrl}/api/iot/overview`);
  const overview = (await overviewResponse.json()) as { commands?: Array<{ command_id: string; device_id: string }> };
  const latestCommand = overview.commands?.find((candidate) => candidate.device_id === deviceId);

  if (!latestCommand) {
    console.error('No command found for this device. Trigger sos-button, rest-button, high-temperature, or a buzzer API call first.');
    process.exit(1);
  }

  const ack = {
    topic: topic('commands/ack'),
    payload: envelope('COMMAND_ACK', {
      commandId: latestCommand.command_id,
      accepted: true,
      reason: null
    })
  };

  const result = {
    topic: topic('commands/result'),
    payload: envelope('COMMAND_RESULT', {
      commandId: latestCommand.command_id,
      status: succeeded ? 'SUCCEEDED' : 'FAILED',
      executedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      errorCode: succeeded ? null : 'SIMULATED_BUZZER_FAILURE',
      errorMessage: succeeded ? null : 'Simulated buzzer failure'
    })
  };

  for (const message of [ack, result]) {
    const response = await fetch(`${apiBaseUrl}/api/dev/iot/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    const body = await response.json();
    console.log(`${message.topic}: ${response.status}`);
    console.log(JSON.stringify(body, null, 2));
  }
}

await main();
