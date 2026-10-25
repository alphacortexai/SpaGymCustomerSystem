import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeOperationQuota,
  keyAccessState,
  keyFlags,
  lookupFingerprint,
  lookupSubject,
  normalizeScopes,
  requiredScope,
  scopeAllows,
  scopesFromEnvironment,
  SPA_SYS_READ_SCOPES,
  SPA_SYS_SCOPES,
  takeDistinctLookup,
  validateExpiresAt,
} from './spaSysAccess.js';

const NOW = new Date('2026-10-25T12:00:00.000Z');

test('a missing scope list keeps today working, and a new key starts read-only', () => {
  assert.deepEqual(normalizeScopes(undefined, { whenMissing: 'all' }).scopes, SPA_SYS_SCOPES);
  assert.deepEqual(normalizeScopes(null, { whenMissing: 'read' }).scopes, SPA_SYS_READ_SCOPES);
  assert.deepEqual(normalizeScopes(['clients:read', 'nope', 'clients:read']).scopes, ['clients:read']);
  assert.equal(normalizeScopes([]).error, 'Choose at least one permission.');
  assert.equal(normalizeScopes('clients:read').error, 'Permissions must be a list.');
  assert.deepEqual(scopesFromEnvironment(undefined), SPA_SYS_SCOPES);
  assert.deepEqual(scopesFromEnvironment(''), SPA_SYS_SCOPES);
  assert.deepEqual(scopesFromEnvironment('clients:read, nope'), ['clients:read']);
  assert.deepEqual(scopesFromEnvironment('nope'), []);
});

test('each route asks for the permission that matches the data it returns', () => {
  assert.equal(requiredScope({ kind: 'index', method: 'GET' }), '');
  assert.equal(requiredScope({ kind: 'branches', method: 'GET' }), 'branches:read');
  assert.equal(requiredScope({ kind: 'clients', method: 'GET' }), 'clients:read');
  assert.equal(requiredScope({ kind: 'client', method: 'PATCH' }), 'clients:update');
  assert.equal(requiredScope({ kind: 'client-check-ins', method: 'GET' }), 'checkins:read');
  assert.equal(requiredScope({ kind: 'check-ins', method: 'GET', hasPhone: true }), 'checkins:read');
  assert.equal(requiredScope({ kind: 'check-ins', method: 'GET', hasClient: true }), 'checkins:read');
  assert.equal(requiredScope({ kind: 'check-ins', method: 'GET' }), 'checkins:register');
  assert.equal(requiredScope({ kind: 'check-outs', method: 'POST' }), 'checkouts:write');
  assert.equal(requiredScope({ kind: 'check-in-checkout', method: 'POST' }), 'checkouts:write');
  assert.equal(scopeAllows(SPA_SYS_READ_SCOPES, 'clients:read'), true);
  assert.equal(scopeAllows(SPA_SYS_READ_SCOPES, 'clients:update'), false);
  assert.equal(scopeAllows(SPA_SYS_READ_SCOPES, ''), true);
  assert.equal(lookupSubject({ kind: 'check-ins', method: 'GET', phone: '0782000000' }), '0782000000');
  assert.equal(lookupSubject({ kind: 'check-ins', method: 'GET' }), '');
  assert.equal(lookupSubject({ kind: 'clients', method: 'PATCH', phone: '0782000000' }), '');
});

test('reads, writes, and distinct clients have separate ceilings', () => {
  const buckets = new Map();
  const lookups = new Map();
  for (let index = 0; index < 40; index += 1) {
    assert.equal(consumeOperationQuota({ keyId: 'key-a', operation: 'reads', now: NOW, buckets }).status, 200);
  }
  const limited = consumeOperationQuota({ keyId: 'key-a', operation: 'reads', now: NOW, buckets });
  assert.equal(limited.status, 429);
  assert.ok(limited.retryAfterSeconds >= 1);
  assert.equal(consumeOperationQuota({ keyId: 'key-a', operation: 'updates', now: NOW, buckets }).status, 200);
  for (let index = 0; index < 29; index += 1) {
    assert.equal(consumeOperationQuota({ keyId: 'key-a', operation: 'checkouts', now: NOW, buckets }).status, 200);
  }
  assert.equal(consumeOperationQuota({ keyId: 'key-a', operation: 'updates', now: NOW, buckets }).status, 429);
  assert.equal(consumeOperationQuota({ keyId: 'key-b', operation: 'reads', now: NOW, buckets }).status, 200);

  for (let index = 0; index < 100; index += 1) {
    const result = takeDistinctLookup({
      keyId: 'key-a',
      fingerprint: lookupFingerprint(`0782${String(index).padStart(6, '0')}`),
      now: NOW,
      buckets: lookups,
    });
    assert.equal(result.fresh, true);
  }
  const repeat = takeDistinctLookup({
    keyId: 'key-a',
    fingerprint: lookupFingerprint('0782000000'),
    now: NOW,
    buckets: lookups,
  });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.fresh, false);
  const blocked = takeDistinctLookup({
    keyId: 'key-a',
    fingerprint: lookupFingerprint('0799000000'),
    now: NOW,
    buckets: lookups,
  });
  assert.equal(blocked.status, 429);
  assert.equal(JSON.stringify([...lookups.values()]).includes('0782000000'), false);
  const later = new Date(NOW.getTime() + 60 * 60 * 1000);
  assert.equal(takeDistinctLookup({
    keyId: 'key-a',
    fingerprint: lookupFingerprint('0799000000'),
    now: later,
    buckets: lookups,
  }).status, 200);
});

test('expiry and the previous key window decide whether a stored key still works', () => {
  assert.equal(validateExpiresAt('', NOW).expiresAt, null);
  assert.equal(validateExpiresAt('   ', NOW).expiresAt, null);
  assert.match(validateExpiresAt('2020-01-01T00:00:00.000Z', NOW).error, /future expiry/);
  assert.equal(validateExpiresAt('not-a-date', NOW).error, 'Expiry must be a real date and time.');
  assert.equal(validateExpiresAt('2026-12-01T09:00:00.000Z', NOW).expiresAt, '2026-12-01T09:00:00.000Z');
  assert.equal(keyAccessState({ status: 'revoked', expiresAt: '2026-12-01T00:00:00.000Z' }, { now: NOW }), 'revoked');
  assert.equal(keyAccessState({ expiresAt: '2026-10-25T11:00:00.000Z' }, { now: NOW }), 'expired');
  assert.equal(keyAccessState({ expiresAt: null }, { now: NOW }), 'active');
  assert.equal(keyAccessState({}, { now: NOW, usingPrevious: true }), 'expired');
  assert.equal(keyAccessState({
    previousKeyExpiresAt: '2026-10-26T12:00:00.000Z',
  }, { now: NOW, usingPrevious: true }), 'active');
  assert.equal(keyAccessState({
    expiresAt: '2026-10-25T11:00:00.000Z',
    previousKeyExpiresAt: '2026-10-26T12:00:00.000Z',
  }, { now: NOW, usingPrevious: true }), 'expired');
  assert.deepEqual(keyFlags({ distinctLookups: 100, reads: 3, updates: 39 }), { manyLookups: true, manyUpdates: false });
  assert.deepEqual(keyFlags({ distinctLookups: 1, reads: 300, updates: 40 }), { manyLookups: true, manyUpdates: true });
});
