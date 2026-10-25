import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { addressesArePublic, buildCheckInAlert, deliverCheckInAlert, signSpaSysWebhook, webhookTargetIsAllowed } from './spaSysWebhook.js';

const SECRET = 'd'.repeat(40);

test('signs the raw body with the timestamp so the other system can verify it', () => {
  const body = '{"event":"client.checked_in"}';
  const signature = signSpaSysWebhook({ secret: SECRET, timestamp: '1760000000', body });
  const expected = createHmac('sha256', SECRET).update(`1760000000.${body}`).digest('hex');
  assert.equal(signature, expected);
});

test('allows a public https webhook and refuses private or cleartext targets', () => {
  assert.equal(webhookTargetIsAllowed('https://partner.example/hooks/spagym', 'production'), true);
  assert.equal(webhookTargetIsAllowed('http://partner.example/hooks/spagym', 'production'), false);
  assert.equal(webhookTargetIsAllowed('https://169.254.169.254/latest', 'production'), false);
  assert.equal(webhookTargetIsAllowed('https://user:pass@partner.example/hook', 'production'), false);
  assert.equal(webhookTargetIsAllowed('http://127.0.0.1:4000/hook', 'development'), true);
  assert.equal(webhookTargetIsAllowed('http://127.0.0.1:4000/hook', 'production'), false);
  assert.equal(webhookTargetIsAllowed('https://[::1]/hook', 'production'), false);
  assert.equal(webhookTargetIsAllowed('https://[fd00::1]/hook', 'production'), false);
  assert.equal(webhookTargetIsAllowed('https://[fe80::1]/hook', 'production'), false);
  assert.equal(addressesArePublic([{ address: '203.0.113.10', family: 4 }]), true);
  assert.equal(addressesArePublic([{ address: '203.0.113.10' }, { address: '10.0.0.4' }]), false);
  assert.equal(addressesArePublic([{ address: '::ffff:192.168.1.9' }]), false);
  assert.equal(addressesArePublic([]), false);
});

test('check-in alert carries name, phone, birthday month and day, and the visit', () => {
  const alert = buildCheckInAlert({
    sentAt: '2026-10-24T06:12:00.000Z',
    client: { id: 'abc123', name: 'Amina Nakato', phoneNumber: '0782000000', birthMonth: 3, birthDay: 15, branch: 'Kololo' },
    visit: { id: 'visit123', clientId: 'abc123', checkedInBranch: 'Kololo', visitDate: '2026-10-24', checkedInAt: '2026-10-24T06:12:00.000Z' },
  });
  assert.equal(alert.event, 'client.checked_in');
  assert.equal(alert.api, 'SPA_SYS_API_V1');
  assert.deepEqual(alert.client.dateOfBirth, { month: 3, day: 15, year: null });
  assert.equal(alert.checkIn.id, 'visit123');
  assert.equal(alert.checkIn.status, 'checked-in');
});

test('posts one signed alert and does nothing when no webhook is configured', async () => {
  const calls = [];
  const payload = buildCheckInAlert({
    sentAt: '2026-10-24T06:12:00.000Z',
    client: { id: 'abc123', name: 'Amina', phone: '0782000000', birthMonth: 3, birthDay: 15 },
    visit: { id: 'visit123', checkedInAt: '2026-10-24T06:12:00.000Z', visitDate: '2026-10-24' },
  });
  const skipped = await deliverCheckInAlert({ payload, env: {}, fetchImpl: async () => { throw new Error('should not be called'); } });
  assert.deepEqual(skipped, { delivered: false, reason: 'not_configured' });

  const result = await deliverCheckInAlert({
    payload,
    now: new Date('2026-10-24T06:12:05.000Z'),
    env: { SPA_SYS_WEBHOOK_URL: 'https://partner.example/hooks/spagym', SPA_SYS_WEBHOOK_SECRET: SECRET, NODE_ENV: 'production' },
    lookupImpl: async () => [{ address: '203.0.113.10', family: 4 }],
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 204 };
    },
  });
  assert.equal(result.delivered, true);
  assert.equal(calls[0].url, 'https://partner.example/hooks/spagym');
  assert.equal(calls[0].init.redirect, 'error');
  const signature = calls[0].init.headers['X-Spa-Sys-Signature'];
  const timestamp = calls[0].init.headers['X-Spa-Sys-Timestamp'];
  assert.equal(signature, `sha256=${signSpaSysWebhook({ secret: SECRET, timestamp, body: calls[0].init.body })}`);
  assert.equal(calls[0].init.body.includes(SECRET), false);
});

test('refuses a webhook whose name resolves to a private address', async () => {
  const payload = buildCheckInAlert({
    sentAt: '2026-10-24T06:12:00.000Z',
    client: { id: 'abc123', name: 'Amina' },
    visit: { id: 'visit123', visitDate: '2026-10-24' },
  });
  let fetched = false;
  const env = { SPA_SYS_WEBHOOK_URL: 'https://partner.example/hooks/spagym', SPA_SYS_WEBHOOK_SECRET: SECRET, NODE_ENV: 'production' };
  const blocked = await deliverCheckInAlert({
    payload,
    env,
    fetchImpl: async () => { fetched = true; return { ok: true, status: 200 }; },
    lookupImpl: async () => [{ address: '10.1.2.3', family: 4 }, { address: '203.0.113.10', family: 4 }],
  });
  assert.deepEqual(blocked, { delivered: false, reason: 'rejected_url' });
  assert.equal(fetched, false);
  const unresolved = await deliverCheckInAlert({
    payload,
    env,
    fetchImpl: async () => { throw new Error('should not fetch'); },
    lookupImpl: async () => { throw new Error('ENOTFOUND'); },
  });
  assert.deepEqual(unresolved, { delivered: false, reason: 'rejected_url' });
});
