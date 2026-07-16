import { authenticateUser, getNotifications, getTasks, getUsers, getWorkers, getWorkforceData, initializeDatabase, markNotificationRead } from './database';

const port = Number(process.env.API_PORT ?? 3001);

initializeDatabase();

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
      return jsonResponse({ ok: true, database: 'sqlite', service: 'garudie-api' });
    }

    if (request.method === 'GET' && url.pathname === '/api/workforce') {
      return jsonResponse(getWorkforceData());
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      try {
        const body = (await request.json()) as { email?: string; password?: string };

        if (!body.email || !body.password) {
          return jsonResponse({ error: 'Email and password are required' }, { status: 400 });
        }

        const user = authenticateUser(body.email, body.password);

        if (!user) {
          return jsonResponse({ error: 'Invalid email or password' }, { status: 401 });
        }

        return jsonResponse({ user });
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/users') {
      return jsonResponse(getUsers());
    }

    if (request.method === 'GET' && url.pathname === '/api/workers') {
      return jsonResponse(getWorkers());
    }

    if (request.method === 'GET' && url.pathname === '/api/tasks') {
      return jsonResponse(getTasks());
    }

    if (request.method === 'GET' && url.pathname === '/api/notifications') {
      return jsonResponse(getNotifications());
    }

    const notificationReadMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);

    if (request.method === 'PATCH' && notificationReadMatch) {
      const notification = markNotificationRead(notificationReadMatch[1]);

      if (!notification) {
        return jsonResponse({ error: 'Notification not found' }, { status: 404 });
      }

      return jsonResponse(notification);
    }

    return jsonResponse({ error: 'Not found' }, { status: 404 });
  }
});

console.log(`Garudie API listening on http://${server.hostname}:${server.port}`);
