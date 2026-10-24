import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifySpaSysOperation,
  listDateKeys,
  statusBucket,
  summarizeSpaSysUsage,
  usageDocId,
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
});
