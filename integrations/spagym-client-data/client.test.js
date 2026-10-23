import assert from 'node:assert/strict';
import test from 'node:test';
import { SpaGymApiError, createSpaGymClient } from './client.js';

const KEY = 'c'.repeat(40);
const ORIGIN = 'https://spagym.example';

function jsonResponse(status, body, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => JSON.stringify(body),
  };
}

function mockFetch(responses) {
  const calls = [];
  const queue = [...responses];
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

function clientWith(fetchImpl, sleep = async () => {}) {
  return createSpaGymClient({ baseUrl: ORIGIN, apiKey: KEY, fetchImpl, sleep, timeoutMs: 1000 });
}

test('sends the key only in the Authorization header and reads the service index', async () => {
  const { calls, fetchImpl } = mockFetch([
    jsonResponse(200, { service: 'spagym-client-data', readOnly: true }),
  ]);
  const body = await clientWith(fetchImpl).ping();
  assert.equal(body.readOnly, true);
  assert.equal(calls[0].url, `${ORIGIN}/api/integrations/client-data/v1`);
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(calls[0].url.includes(KEY), false);
  assert.equal(calls[0].init.method, 'GET');
});

test('looks up a phone, loads one client, and asks for that client’s visits', async () => {
  const { calls, fetchImpl } = mockFetch([
    jsonResponse(200, { count: 1, clients: [{ id: 'abc123', name: 'Amina Nakato' }] }),
    jsonResponse(200, { client: { id: 'abc123', name: 'Amina Nakato' } }),
    jsonResponse(200, { count: 0, checkIns: [] }),
  ]);
  const api = clientWith(fetchImpl);
  const found = await api.findClients({ phone: '0782 000 000' });
  const client = await api.getClient(found.clients[0].id);
  const visits = await api.listClientCheckIns(client.id, { from: '2026-10-01', to: '2026-10-24' });
  assert.equal(found.count, 1);
  assert.equal(calls[0].url, `${ORIGIN}/api/integrations/client-data/v1/clients?phone=0782+000+000`);
  assert.equal(calls[1].url, `${ORIGIN}/api/integrations/client-data/v1/clients/abc123`);
  assert.equal(calls[2].url, `${ORIGIN}/api/integrations/client-data/v1/clients/abc123/check-ins?from=2026-10-01&to=2026-10-24`);
  assert.deepEqual(visits.checkIns, []);
});

test('lists branches and filters a day’s register', async () => {
  const { calls, fetchImpl } = mockFetch([
    jsonResponse(200, { branches: [{ id: 'b1', name: 'Kololo' }] }),
    jsonResponse(200, { branch: 'Kololo', count: 0, checkIns: [], truncated: false }),
  ]);
  const api = clientWith(fetchImpl);
  assert.deepEqual(await api.listBranches(), [{ id: 'b1', name: 'Kololo' }]);
  await api.listCheckIns({ date: '2026-10-24', branch: 'b1' });
  assert.equal(calls[1].url, `${ORIGIN}/api/integrations/client-data/v1/check-ins?date=2026-10-24&branch=b1`);
});

test('stops on an unauthorized key and waits once after a rate limit', async () => {
  const unauthorized = mockFetch([jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Unauthorized.' } })]);
  await assert.rejects(clientWith(unauthorized.fetchImpl).ping(), (error) => {
    assert.equal(error instanceof SpaGymApiError, true);
    assert.equal(error.status, 401);
    assert.equal(unauthorized.calls.length, 1);
    return true;
  });

  const limited = mockFetch([
    jsonResponse(429, { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } }, { 'retry-after': '2' }),
    jsonResponse(200, { readOnly: true }),
  ]);
  const delays = [];
  const body = await clientWith(limited.fetchImpl, async (ms) => delays.push(ms)).ping();
  assert.equal(body.readOnly, true);
  assert.deepEqual(delays, [2000]);
  assert.equal(limited.calls.length, 2);
});

test('retries a server error and surfaces a missing client', async () => {
  const flaky = mockFetch([
    jsonResponse(503, { error: { code: 'INTERNAL', message: 'Internal server error.' } }),
    jsonResponse(200, { branches: [] }),
  ]);
  assert.deepEqual(await clientWith(flaky.fetchImpl).listBranches(), []);
  assert.equal(flaky.calls.length, 2);

  const missing = mockFetch([
    jsonResponse(404, { error: { code: 'CLIENT_NOT_FOUND', message: 'No client record matches that id.' } }),
  ]);
  await assert.rejects(clientWith(missing.fetchImpl).getClient('abc123'), (error) => error.code === 'CLIENT_NOT_FOUND');
});

test('rejects a client configuration that would expose the key or call over cleartext', () => {
  assert.throws(() => createSpaGymClient({ baseUrl: 'http://spagym.example', apiKey: KEY, fetchImpl: async () => {} }), /HTTPS/);
  assert.throws(() => createSpaGymClient({ baseUrl: 'https://spagym.example/api', apiKey: KEY, fetchImpl: async () => {} }), /origin only/);
  assert.throws(() => createSpaGymClient({ baseUrl: ORIGIN, apiKey: 'too-short', fetchImpl: async () => {} }), /32 characters/);
  assert.doesNotThrow(() => createSpaGymClient({ baseUrl: 'http://127.0.0.1:3456/', apiKey: KEY, fetchImpl: async () => {} }));
});
