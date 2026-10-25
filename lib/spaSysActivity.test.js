import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifySpaSysOperation,
  describeSpaSysRequest,
  listDateKeys,
  publicRequestLog,
  statusBucket,
  summarizeSpaSysUsage,
  usageDocId,
  webhookFailureText,
  webhookHost,
} from './spaSysActivity.js';

test('classifies reads, updates, and check-outs without keeping the request path', () => {
  assert.equal(classifySpaSysOperation('GET', 'clients'), 'reads');
  assert.equal(classifySpaSysOperation('PATCH', 'client'), 'updates');
  assert.equal(classifySpaSysOperation('POST', 'check-outs'), 'checkouts');
  assert.equal(classifySpaSysOperation('GET', 'not-found'), 'other');
  assert.equal(statusBucket(200), 'ok');
  assert.equal(statusBucket(409), 'clientError');
  assert.equal(statusBucket(500), 'serverError');
  const id = usageDocId('api', '2026-10-24', 'env_abcdef1234567890');
  assert.equal(id, 'api_2026-10-24_env_abcdef1234567890');
  assert.equal(usageDocId('api', '2026-10-24', 'raw key with spaces'), 'api_2026-10-24_rawkeywithspaces');
  assert.equal(webhookHost('https://partner.example/hooks/spagym'), 'partner.example');
});

test('measures every registered key and separates webhook deliveries', () => {
  const summary = summarizeSpaSysUsage([
    {
      day: '2026-10-24', kind: 'api', subjectId: 'desk1', source: 'registered', name: 'Front desk', keyPreview: 'abcd1234',
      requests: 4, reads: 3, updates: 1, ok: 3, clientError: 1, updatedAt: '2026-10-24T12:00:00.000Z',
    },
    {
      day: '2026-10-23', kind: 'api', subjectId: 'env_aaaabbbbccccdddd', source: 'environment', name: 'Environment key', keyPreview: '01234567',
      requests: 2, reads: 2, ok: 2, updatedAt: '2026-10-23T09:00:00.000Z',
    },
    {
      day: '2026-10-24', kind: 'api', subjectId: 'unrecognized', source: 'unrecognized', requests: 5,
    },
    {
      day: '2026-10-24', kind: 'webhook', subjectId: 'desk1', name: 'Front desk', host: 'partner.example',
      delivered: 2, failed: 1, lastStatus: 500, lastReason: 'http_500', updatedAt: '2026-10-24T12:05:00.000Z',
    },
  ], {
    from: '2026-10-23',
    to: '2026-10-24',
    integrations: [
      { id: 'desk1', name: 'Front desk', keyPreview: 'abcd1234', status: 'active', webhookUrl: 'https://partner.example/hooks', webhookConfigured: true },
      { id: 'quiet1', name: 'Quiet app', keyPreview: 'zzzz9999', status: 'revoked', webhookUrl: '', webhookConfigured: false },
    ],
    environmentWebhookHost: 'hooks.example',
  });

  assert.deepEqual(listDateKeys(summary.from, summary.to), ['2026-10-23', '2026-10-24']);
  assert.equal(summary.rejected, 5);
  assert.equal(summary.api.requests, 11);
  assert.equal(summary.api.keys.length, 3);
  const quiet = summary.api.keys.find((item) => item.subjectId === 'quiet1');
  assert.equal(quiet.requests, 0);
  assert.equal(quiet.status, 'revoked');
  const desk = summary.api.keys.find((item) => item.subjectId === 'desk1');
  assert.equal(desk.reads, 3);
  assert.equal(desk.updates, 1);
  assert.equal(summary.api.keys.some((item) => item.subjectId === 'unrecognized'), false);
  assert.equal(JSON.stringify(summary).includes('webhookSecret'), false);
  assert.equal(summary.webhooks.delivered, 2);
  assert.equal(summary.webhooks.failed, 1);
  assert.equal(summary.webhooks.targets.find((item) => item.subjectId === 'env').host, 'hooks.example');
  assert.equal(summary.webhooks.targets.find((item) => item.subjectId === 'desk1').lastReason, 'http_500');
  assert.equal(summary.api.days[0].requests, 2);
  assert.equal(summary.api.days[1].requests, 9);
  assert.equal(summary.alerts.rejectedBurst, false);
  assert.equal(desk.manyLookups, false);
  assert.equal(desk.manyUpdates, false);
  assert.equal(desk.distinctLookups, 0);
});

test('flags a key with many lookups or updates, and a burst of rejected calls', () => {
  const summary = summarizeSpaSysUsage([
    {
      day: '2026-10-24', kind: 'api', subjectId: 'desk1', source: 'registered', name: 'Front desk',
      requests: 140, reads: 100, updates: 40, distinctLookups: 100, ok: 140,
    },
    { day: '2026-10-24', kind: 'api', subjectId: 'unrecognized', source: 'unrecognized', requests: 50 },
  ], { from: '2026-10-24', to: '2026-10-24' });
  const desk = summary.api.keys[0];
  assert.equal(desk.distinctLookups, 100);
  assert.equal(desk.manyLookups, true);
  assert.equal(desk.manyUpdates, true);
  assert.equal(summary.alerts.rejectedBurst, true);
});

test('request logs name the call and the error without keeping a phone number', () => {
  const read = describeSpaSysRequest({ method: 'GET', kind: 'clients', hasPhone: true });
  assert.equal(read.request, 'Read by phone');
  assert.equal(read.path.includes('?'), false);
  const failed = publicRequestLog('log1', {
    at: '2026-10-24T16:00:00.000Z',
    channel: 'api',
    name: 'Front desk',
    keyPreview: 'abcd1234',
    source: 'registered',
    request: read.request,
    path: `${read.path}?phone=0782000000`,
    success: false,
    status: 409,
    errorCode: 'PHONE_IN_USE',
    errorMessage: 'Another client already uses 0782000000.',
  });
  assert.equal(failed.success, false);
  assert.equal(failed.errorCode, 'PHONE_IN_USE');
  assert.equal(failed.errorMessage.includes('0782000000'), false);
  assert.equal(failed.path.includes('0782000000'), false);
  assert.equal(failed.path.includes('?'), false);
  assert.equal(failed.clientId, '');
  const named = publicRequestLog('log3', {
    status: 200,
    request: 'Update client',
    success: true,
    requestId: 'AbC123def456',
    clientId: 'abc123',
  });
  assert.equal(named.requestId, 'abc123def456');
  assert.equal(named.clientId, 'abc123');
  assert.equal(publicRequestLog('log4', { clientId: '0782000000', requestId: 'not a key' }).clientId, '');
  const ok = publicRequestLog('log2', { status: 200, request: 'Check out client', success: true, errorMessage: 'hidden' });
  assert.equal(ok.success, true);
  assert.equal(ok.errorMessage, '');
  assert.equal(webhookFailureText('network', 0), 'The other system could not be reached.');
});
