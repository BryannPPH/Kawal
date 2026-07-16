import { authenticateUser, autoAssignTask, createTask, getNotifications, getTasks, getUsers, getWorkers, getWorkforceData, initializeDatabase, markNotificationRead } from './database';
import { estimateCapacity } from './capacityEstimator';
import { forecastProductivity } from './chronosForecasting';
import {
  approveRestRequest,
  assignDevice,
  completeBreak,
  evaluateWorkerFatigue,
  evaluateWorkerRisk,
  expirePendingCommands,
  getActiveIncidents,
  getCurrentBreak,
  getCurrentEnvironmentBySite,
  getCurrentEnvironmentByZone,
  getDataReadiness,
  getDevice,
  getEnvironmentHistory,
  getIncident,
  getIncidentCenter,
  getIoTOverview,
  getLatestFatigue,
  getLatestRisk,
  getRestRequest,
  getRestRequests,
  getFatigueHistory,
  getRiskHistory,
  listDevices,
  processIoTMessage,
  publishDeviceCommand,
  rejectRestRequest,
  unassignDevice,
  updateIncidentState,
  updateSiteConditions
} from './iot';
import { recommendWorkers } from './workerAssignmentEngine';
import {
  assertSupabaseConfigured,
  autoAssignSupabaseTask,
  authenticateSupabaseUser,
  createSupabaseTask,
  getDataSourceName,
  getSupabaseIncidentCenter,
  getSupabaseIoTOverview,
  getSupabaseNotifications,
  getSupabaseTasks,
  getSupabaseUsers,
  getSupabaseWorkerAppData,
  getSupabaseWorkers,
  getSupabaseWorkforceData,
  ingestSupabaseIoTMessage,
  listSupabaseDevices,
  markSupabaseNotificationRead,
  completeSupabaseWorkerAssignment,
  reportSupabaseWorkerHazard,
  requestSupabaseWorkerRest,
  shouldUseSupabase,
  triggerSupabaseWorkerSos,
  updateSupabaseWorkerShiftStatus,
  updateSupabaseIncidentState
} from './supabase';
import {
  completeWorkerAssignment,
  getWorkerAppData,
  performWorkerPpeCheck,
  readWorkerNotification,
  reportWorkerHazard,
  requestWorkerRest,
  triggerWorkerSos,
  updateWorkerShiftStatus
} from './workerActions';

const port = Number(process.env.API_PORT ?? 3001);
const useSupabase = shouldUseSupabase();

initializeDatabase();

if (useSupabase) {
  assertSupabaseConfigured();
}

const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function jsonResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...init?.headers
    }
  });
}

const server = Bun.serve({
  port,
  hostname: '127.0.0.1',
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: jsonHeaders
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return jsonResponse({ ok: true, database: getDataSourceName(), service: 'garudie-api' });
    }

    if (request.method === 'GET' && url.pathname === '/api/workforce') {
      return jsonResponse(useSupabase ? await getSupabaseWorkforceData() : await getWorkforceData());
    }

    if (request.method === 'GET' && url.pathname === '/api/iot/overview') {
      return jsonResponse(useSupabase ? await getSupabaseIoTOverview() : getIoTOverview());
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      try {
        const body = (await request.json()) as { email?: string; password?: string };

        if (!body.email || !body.password) {
          return jsonResponse({ error: 'Email and password are required' }, { status: 400 });
        }

        const user = useSupabase
          ? await authenticateSupabaseUser(body.email, body.password)
          : authenticateUser(body.email, body.password);

        if (!user) {
          return jsonResponse({ error: 'Invalid email or password' }, { status: 401 });
        }

        return jsonResponse({ user });
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/users') {
      return jsonResponse(useSupabase ? await getSupabaseUsers() : getUsers());
    }

    if (request.method === 'GET' && url.pathname === '/api/workers') {
      return jsonResponse(useSupabase ? await getSupabaseWorkers() : getWorkers());
    }

    const workerAppMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/app$/);

    if (request.method === 'GET' && workerAppMatch) {
      return jsonResponse(useSupabase ? await getSupabaseWorkerAppData(workerAppMatch[1]) : await getWorkerAppData(workerAppMatch[1]));
    }

    const workerStatusMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/status$/);

    if (request.method === 'POST' && workerStatusMatch) {
      const body = await readJsonBody<{ status?: 'waiting' | 'working' | 'break' | 'done' }>(request);

      if (!body.status || !['waiting', 'working', 'break', 'done'].includes(body.status)) {
        return jsonResponse({ error: 'Valid status is required' }, { status: 400 });
      }

      return jsonResponse(useSupabase
        ? await updateSupabaseWorkerShiftStatus(workerStatusMatch[1], body.status)
        : await updateWorkerShiftStatus(workerStatusMatch[1], body.status));
    }

    const workerPpeCheckMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/ppe-check$/);

    if (request.method === 'POST' && workerPpeCheckMatch) {
      const body = await readJsonBody<{ imageDataUrl?: string }>(request);

      if (!body.imageDataUrl) {
        return jsonResponse({ error: 'Camera image is required' }, { status: 400 });
      }

      if (useSupabase) {
        return jsonResponse({ error: 'PPE check is currently wired to the local database mode' }, { status: 501 });
      }

      return jsonResponse(await performWorkerPpeCheck(workerPpeCheckMatch[1], body.imageDataUrl), { status: 201 });
    }

    const workerCompleteMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/complete$/);

    if (request.method === 'POST' && workerCompleteMatch) {
      return jsonResponse(useSupabase
        ? await completeSupabaseWorkerAssignment(workerCompleteMatch[1])
        : await completeWorkerAssignment(workerCompleteMatch[1]));
    }

    const workerHazardMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/hazards$/);

    if (request.method === 'POST' && workerHazardMatch) {
      const body = await readJsonBody<{ hazardType?: string; note?: string }>(request);

      if (!body.hazardType?.trim()) {
        return jsonResponse({ error: 'Hazard type is required' }, { status: 400 });
      }

      return jsonResponse(useSupabase
        ? await reportSupabaseWorkerHazard(workerHazardMatch[1], body)
        : await reportWorkerHazard(workerHazardMatch[1], body));
    }

    const workerRestRequestMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/rest-request$/);

    if (request.method === 'POST' && workerRestRequestMatch) {
      return jsonResponse(useSupabase
        ? await requestSupabaseWorkerRest(workerRestRequestMatch[1])
        : await requestWorkerRest(workerRestRequestMatch[1]), { status: 202 });
    }

    const workerSosMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/sos$/);

    if (request.method === 'POST' && workerSosMatch) {
      return jsonResponse(useSupabase
        ? await triggerSupabaseWorkerSos(workerSosMatch[1])
        : await triggerWorkerSos(workerSosMatch[1]), { status: 202 });
    }

    const workerNotificationReadMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/notifications\/([^/]+)\/read$/);

    if (request.method === 'PATCH' && workerNotificationReadMatch) {
      return jsonResponse(useSupabase
        ? await markSupabaseNotificationRead(workerNotificationReadMatch[2])
        : await readWorkerNotification(workerNotificationReadMatch[1], workerNotificationReadMatch[2]));
    }

    if (request.method === 'GET' && url.pathname === '/api/tasks') {
      return jsonResponse(useSupabase ? await getSupabaseTasks() : await getTasks());
    }

    if (request.method === 'POST' && url.pathname === '/api/capacity/estimate') {
      const body = await readJsonBody<{
        taskTemplate?: string;
        quantity?: number;
        deadline?: string;
        environment?: {
          temperatureC?: number;
          humidityPct?: number;
          workload?: string;
        };
      }>(request);

      if (!body.taskTemplate?.trim() || typeof body.quantity !== 'number' || body.quantity <= 0 || !body.deadline?.trim()) {
        return jsonResponse({ error: 'taskTemplate, quantity, and deadline are required' }, { status: 400 });
      }

      const estimate = estimateCapacity({
        taskTemplate: body.taskTemplate,
        quantity: body.quantity,
        deadline: body.deadline,
        environment: body.environment,
        availableWorkerCount: getWorkers().length
      });

      return jsonResponse({
        recommendedCrewSize: estimate.recommendedCrewSize,
        estimatedDuration: estimate.estimatedDuration,
        estimatedFinishTime: estimate.estimatedFinishTime,
        deadlineFeasibilityStatus: estimate.deadlineFeasibilityStatus,
        totalWorkerHours: estimate.totalWorkerHours
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/assignment/recommend') {
      const body = await readJsonBody<{
        taskTemplate?: string;
        requiredSkills?: string[];
        requiredCertifications?: string[];
        zone?: string;
        recommendedCrewSize?: number;
      }>(request);

      if (!body.taskTemplate?.trim()) {
        return jsonResponse({ error: 'taskTemplate is required' }, { status: 400 });
      }

      return jsonResponse({
        assignmentEngineVersion: 'worker-assignment-engine-v1',
        recommendations: recommendWorkers({
          taskTemplate: body.taskTemplate,
          requiredSkills: body.requiredSkills,
          requiredCertifications: body.requiredCertifications,
          zone: body.zone,
          recommendedCrewSize: body.recommendedCrewSize ?? 3,
          workers: getWorkers()
        })
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/chronos/forecast') {
      const body = await readJsonBody<{
        historicalCompletedQuantity?: number[];
        workerHours?: number[];
        breakMinutes?: number[];
        activeWorkers?: number[];
        predictionLength?: number;
      }>(request);

      if (
        !Array.isArray(body.historicalCompletedQuantity) ||
        !Array.isArray(body.workerHours) ||
        !Array.isArray(body.breakMinutes) ||
        !Array.isArray(body.activeWorkers)
      ) {
        return jsonResponse({ error: 'historicalCompletedQuantity, workerHours, breakMinutes, and activeWorkers arrays are required' }, { status: 400 });
      }

      try {
        return jsonResponse(await forecastProductivity({
          historicalCompletedQuantity: body.historicalCompletedQuantity,
          workerHours: body.workerHours,
          breakMinutes: body.breakMinutes,
          activeWorkers: body.activeWorkers,
          predictionLength: body.predictionLength
        }));
      } catch (error) {
        return jsonResponse({
          error: error instanceof Error ? error.message : 'Chronos service unavailable'
        }, { status: 503 });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/tasks') {
      const body = await readJsonBody<{
        taskTemplate?: string;
        project?: string;
        zone?: string;
        quantity?: number;
        unit?: string;
        deadline?: string;
        priority?: string;
        notes?: string;
      }>(request);

      if (
        !body.taskTemplate?.trim() ||
        !body.project?.trim() ||
        !body.zone?.trim() ||
        typeof body.quantity !== 'number' ||
        body.quantity <= 0 ||
        !body.unit?.trim() ||
        !body.deadline?.trim() ||
        !body.priority?.trim()
      ) {
        return jsonResponse({ error: 'Task template, project, zone, quantity, unit, deadline, and priority are required' }, { status: 400 });
      }

      const taskInput = {
        taskTemplate: body.taskTemplate,
        project: body.project,
        zone: body.zone,
        quantity: body.quantity,
        unit: body.unit,
        deadline: body.deadline,
        priority: body.priority,
        notes: body.notes
      };

      return jsonResponse(useSupabase ? await createSupabaseTask(taskInput) : await createTask(taskInput), { status: 201 });
    }

    const autoAssignTaskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/auto-assign$/);

    if (request.method === 'PATCH' && autoAssignTaskMatch) {
      try {
        const task = useSupabase
          ? await autoAssignSupabaseTask(autoAssignTaskMatch[1])
          : await autoAssignTask(autoAssignTaskMatch[1]);
        return task ? jsonResponse(task) : jsonResponse({ error: 'Task not found' }, { status: 404 });
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : 'Unable to assign task' }, { status: 409 });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/notifications') {
      return jsonResponse(useSupabase ? await getSupabaseNotifications() : getNotifications());
    }

    if (request.method === 'GET' && url.pathname === '/api/iot/devices') {
      return jsonResponse(useSupabase ? await listSupabaseDevices() : listDevices());
    }

    const deviceMatch = url.pathname.match(/^\/api\/iot\/devices\/([^/]+)$/);

    if (request.method === 'GET' && deviceMatch) {
      const device = getDevice(deviceMatch[1]);
      return device ? jsonResponse(device) : jsonResponse({ error: 'Device not found' }, { status: 404 });
    }

    const deviceAssignMatch = url.pathname.match(/^\/api\/iot\/devices\/([^/]+)\/assign$/);

    if (request.method === 'POST' && deviceAssignMatch) {
      const body = await readJsonBody<{ workerId?: string; siteId?: string; zoneId?: string; taskId?: string }>(request);
      const device = assignDevice(deviceAssignMatch[1], body);
      return device ? jsonResponse(device) : jsonResponse({ error: 'Device not found' }, { status: 404 });
    }

    const deviceUnassignMatch = url.pathname.match(/^\/api\/iot\/devices\/([^/]+)\/unassign$/);

    if (request.method === 'POST' && deviceUnassignMatch) {
      const device = unassignDevice(deviceUnassignMatch[1]);
      return device ? jsonResponse(device) : jsonResponse({ error: 'Device not found' }, { status: 404 });
    }

    const deviceCommandsMatch = url.pathname.match(/^\/api\/iot\/devices\/([^/]+)\/commands$/);

    if (request.method === 'GET' && deviceCommandsMatch) {
      return jsonResponse(getIoTOverview().commands.filter((command: any) => command.device_id === deviceCommandsMatch[1]));
    }

    const deviceBuzzerMatch = url.pathname.match(/^\/api\/iot\/devices\/([^/]+)\/commands\/buzzer$/);

    if (request.method === 'POST' && deviceBuzzerMatch) {
      const body = await readJsonBody<{ pattern?: string; durationMs?: number }>(request);
      return jsonResponse(publishDeviceCommand({
        deviceId: deviceBuzzerMatch[1],
        commandType: 'BUZZER',
        priority: 'HIGH',
        payload: {
          pattern: body.pattern ?? 'WARNING',
          repeat: 1,
          durationMs: body.durationMs ?? 1000
        }
      }), { status: 201 });
    }

    const siteEnvironmentMatch = url.pathname.match(/^\/api\/sites\/([^/]+)\/environment\/current$/);

    if (request.method === 'GET' && siteEnvironmentMatch) {
      return jsonResponse(getCurrentEnvironmentBySite(siteEnvironmentMatch[1]));
    }

    if (request.method === 'POST' && siteEnvironmentMatch) {
      const body = await readJsonBody<{
        zoneId?: string;
        temperatureC?: number;
        humidityPct?: number;
        weather?: string;
        surfaceCondition?: string;
        craneActive?: boolean;
        restrictedZoneDetected?: boolean;
      }>(request);

      if (!body.zoneId || typeof body.temperatureC !== 'number' || typeof body.humidityPct !== 'number' || !body.weather || !body.surfaceCondition) {
        return jsonResponse({ error: 'zoneId, temperatureC, humidityPct, weather, and surfaceCondition are required' }, { status: 400 });
      }

      const result = updateSiteConditions({
        siteId: siteEnvironmentMatch[1],
        zoneId: body.zoneId,
        temperatureC: body.temperatureC,
        humidityPct: body.humidityPct,
        weather: body.weather,
        surfaceCondition: body.surfaceCondition,
        craneActive: Boolean(body.craneActive),
        restrictedZoneDetected: Boolean(body.restrictedZoneDetected)
      });

      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    const zoneEnvironmentCurrentMatch = url.pathname.match(/^\/api\/zones\/([^/]+)\/environment\/current$/);

    if (request.method === 'GET' && zoneEnvironmentCurrentMatch) {
      return jsonResponse(getCurrentEnvironmentByZone(decodeURIComponent(zoneEnvironmentCurrentMatch[1])) ?? null);
    }

    const zoneEnvironmentHistoryMatch = url.pathname.match(/^\/api\/zones\/([^/]+)\/environment\/history$/);

    if (request.method === 'GET' && zoneEnvironmentHistoryMatch) {
      return jsonResponse(getEnvironmentHistory(decodeURIComponent(zoneEnvironmentHistoryMatch[1])));
    }

    if (request.method === 'GET' && url.pathname === '/api/rest-requests') {
      return jsonResponse(getRestRequests());
    }

    const restRequestMatch = url.pathname.match(/^\/api\/rest-requests\/([^/]+)$/);

    if (request.method === 'GET' && restRequestMatch) {
      const restRequest = getRestRequest(restRequestMatch[1]);
      return restRequest ? jsonResponse(restRequest) : jsonResponse({ error: 'Rest request not found' }, { status: 404 });
    }

    const restApproveMatch = url.pathname.match(/^\/api\/rest-requests\/([^/]+)\/approve$/);

    if (request.method === 'POST' && restApproveMatch) {
      const restRequest = approveRestRequest(restApproveMatch[1]);
      return restRequest ? jsonResponse(restRequest) : jsonResponse({ error: 'Rest request not found' }, { status: 404 });
    }

    const restRejectMatch = url.pathname.match(/^\/api\/rest-requests\/([^/]+)\/reject$/);

    if (request.method === 'POST' && restRejectMatch) {
      const body = await readJsonBody<{ reason?: string }>(request);

      if (!body.reason) {
        return jsonResponse({ error: 'Rejection reason is required' }, { status: 400 });
      }

      const restRequest = rejectRestRequest(restRejectMatch[1], body.reason);
      return restRequest ? jsonResponse(restRequest) : jsonResponse({ error: 'Rest request not found' }, { status: 404 });
    }

    const workerBreakMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/break\/current$/);

    if (request.method === 'GET' && workerBreakMatch) {
      return jsonResponse(getCurrentBreak(workerBreakMatch[1]) ?? null);
    }

    const workerBreakCompleteMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/break\/complete$/);

    if (request.method === 'POST' && workerBreakCompleteMatch) {
      return jsonResponse(completeBreak(workerBreakCompleteMatch[1]) ?? { completed: true });
    }

    if (request.method === 'GET' && url.pathname === '/api/incidents/active') {
      return jsonResponse(getActiveIncidents());
    }

    if (request.method === 'GET' && url.pathname === '/api/incidents/center') {
      return jsonResponse(useSupabase ? await getSupabaseIncidentCenter() : getIncidentCenter());
    }

    const incidentMatch = url.pathname.match(/^\/api\/incidents\/([^/]+)$/);

    if (request.method === 'GET' && incidentMatch) {
      const incident = getIncident(incidentMatch[1]);
      return incident ? jsonResponse(incident) : jsonResponse({ error: 'Incident not found' }, { status: 404 });
    }

    for (const [action, state] of [
      ['acknowledge', 'ACKNOWLEDGED'],
      ['escalate', 'ESCALATED'],
      ['resolve', 'RESOLVED'],
      ['false-alarm', 'FALSE_ALARM']
    ] as const) {
      const actionMatch = url.pathname.match(new RegExp(`^/api/incidents/([^/]+)/${action}$`));
      if (request.method === 'POST' && actionMatch) {
        const incident = useSupabase
          ? await updateSupabaseIncidentState(actionMatch[1], state)
          : updateIncidentState(actionMatch[1], state);
        return incident ? jsonResponse(incident) : jsonResponse({ error: 'Incident not found' }, { status: 404 });
      }
    }

    const latestRiskMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/risk\/latest$/);
    const latestFatigueMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/fatigue\/latest$/);

    if (request.method === 'GET' && latestFatigueMatch) {
      return jsonResponse(getLatestFatigue(latestFatigueMatch[1]) ?? null);
    }

    if (request.method === 'GET' && latestRiskMatch) {
      return jsonResponse(getLatestRisk(latestRiskMatch[1]) ?? null);
    }

    const riskHistoryMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/risk\/history$/);
    const fatigueHistoryMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/fatigue\/history$/);

    if (request.method === 'GET' && fatigueHistoryMatch) {
      return jsonResponse(getFatigueHistory(fatigueHistoryMatch[1]));
    }

    if (request.method === 'GET' && riskHistoryMatch) {
      return jsonResponse(getRiskHistory(riskHistoryMatch[1]));
    }

    const riskEvaluateMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/risk\/evaluate$/);
    const fatigueEvaluateMatch = url.pathname.match(/^\/api\/workers\/([^/]+)\/fatigue\/evaluate$/);

    if (request.method === 'POST' && fatigueEvaluateMatch) {
      const fatigue = evaluateWorkerFatigue(fatigueEvaluateMatch[1]);
      return fatigue ? jsonResponse(fatigue, { status: 201 }) : jsonResponse({ error: 'Worker has no assigned device' }, { status: 404 });
    }

    if (request.method === 'POST' && riskEvaluateMatch) {
      const risk = evaluateWorkerRisk(riskEvaluateMatch[1]);
      return risk ? jsonResponse(risk, { status: 201 }) : jsonResponse({ error: 'Worker has no assigned device' }, { status: 404 });
    }

    const readinessMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/data-(readiness|quality)$/);

    if (request.method === 'GET' && readinessMatch) {
      return jsonResponse(getDataReadiness(readinessMatch[1]));
    }

    if (request.method === 'POST' && url.pathname === '/api/dev/iot/messages') {
      if (process.env.NODE_ENV === 'production') {
        return jsonResponse({ error: 'Simulation endpoint is disabled in production' }, { status: 403 });
      }

      const body = await readJsonBody<{ topic?: string; payload?: unknown }>(request);

      if (!body.topic || !body.payload) {
        return jsonResponse({ error: 'topic and payload are required' }, { status: 400 });
      }

      const result = useSupabase
        ? await ingestSupabaseIoTMessage(body.topic, JSON.stringify(body.payload))
        : processIoTMessage(body.topic, JSON.stringify(body.payload));
      return jsonResponse(result, { status: result.ok ? 202 : result.status ?? 400 });
    }

    if (request.method === 'POST' && url.pathname === '/api/dev/iot/maintenance') {
      if (process.env.NODE_ENV === 'production') {
        return jsonResponse({ error: 'Simulation endpoint is disabled in production' }, { status: 403 });
      }

      return jsonResponse({
        expiredCommands: expirePendingCommands()
      });
    }

    const notificationReadMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);

    if (request.method === 'PATCH' && notificationReadMatch) {
      const notification = useSupabase
        ? await markSupabaseNotificationRead(notificationReadMatch[1])
        : markNotificationRead(notificationReadMatch[1]);

      if (!notification) {
        return jsonResponse({ error: 'Notification not found' }, { status: 404 });
      }

      return jsonResponse(notification);
    }

    return jsonResponse({ error: 'Not found' }, { status: 404 });
  }
});

console.log(`Kawal API listening on http://${server.hostname}:${server.port}`);

async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}
