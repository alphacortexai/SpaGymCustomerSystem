import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessClientDataAccess,
  authorizePresentedKey,
  credentialsMatch,
  kampalaDateKey,
  parseResultLimit,
  parseVisitWindow,
  readConfiguredSecrets,
  rejectsCleartext,
  clientUpdateChanges,
  resolveClientDataRoute,
  serializeCheckIn,
  serializeClientProfile,
  visitMatchesPhone,
  secretsForAccessMode,
  CLIENT_DATA_API_INDEX,
  SPA_SYS_API_INDEX,
} from './clientDataContract.js';

const SECRET = 'a'.repeat(40);
const NEXT_SECRET = 'b'.repeat(40);

test('rejects cleartext only for a production request the proxy marked as HTTP', () => {
  assert.equal(rejectsCleartext({ forwardedProto: 'http', nodeEnv: 'production' }), true);
  assert.equal(rejectsCleartext({ forwardedProto: 'https, http', nodeEnv: 'production' }), false);
  assert.equal(rejectsCleartext({ forwardedProto: 'http', nodeEnv: 'development' }), false);
  assert.equal(rejectsCleartext({ forwardedProto: '', nodeEnv: 'production' }), false);
});

test('accepts one configured key or a rotation pair and rejects lookalikes', () => {
  assert.deepEqual(readConfiguredSecrets(` ${SECRET}, ${NEXT_SECRET} `), [SECRET, NEXT_SECRET]);
  assert.equal(credentialsMatch(SECRET, [SECRET, NEXT_SECRET]), true);
  assert.equal(credentialsMatch(NEXT_SECRET, [SECRET, NEXT_SECRET]), true);
  assert.equal(credentialsMatch(`${SECRET}x`, [SECRET]), false);
  assert.equal(credentialsMatch(SECRET.slice(0, 20), [SECRET]), false);
  assert.equal(authorizePresentedKey('short-key', ['short-key']).ok, false);
  assert.equal(authorizePresentedKey(SECRET, [SECRET]).ok, true);
});

test('rate limits repeated bad keys without treating a valid key as a failure', () => {
  const authFailures = new Map();
  const acceptedRequests = new Map();
  const input = {
    secrets: [SECRET],
    address: '203.0.113.8',
    authFailures,
    acceptedRequests,
    failureLimit: 2,
    successLimit: 2,
    now: new Date('2026-10-24T00:00:00Z'),
  };
  assert.equal(assessClientDataAccess({ ...input, presentedKey: 'wrong-key-wrong-key-wrong-key-1234' }).status, 401);
  assert.equal(assessClientDataAccess({ ...input, presentedKey: 'wrong-key-wrong-key-wrong-key-1234' }).status, 401);
  assert.equal(assessClientDataAccess({ ...input, presentedKey: 'wrong-key-wrong-key-wrong-key-1234' }).status, 429);
  assert.equal(assessClientDataAccess({ ...input, presentedKey: SECRET }).status, 200);
  assert.equal(assessClientDataAccess({ ...input, presentedKey: SECRET }).status, 200);
  assert.equal(assessClientDataAccess({ ...input, presentedKey: SECRET }).status, 429);
});

test('uses the Kampala calendar day and rejects impossible or oversized windows', () => {
  const lateEveningUtc = new Date('2026-10-23T22:30:00Z');
  assert.equal(kampalaDateKey(lateEveningUtc), '2026-10-24');
  assert.deepEqual(parseVisitWindow(new URLSearchParams(), lateEveningUtc).dates, ['2026-10-24']);
  assert.deepEqual(parseVisitWindow(new URLSearchParams('date=2024-02-29')).dates, ['2024-02-29']);
  assert.throws(() => parseVisitWindow(new URLSearchParams('date=2026-02-29')), /real calendar date/);
  assert.throws(() => parseVisitWindow(new URLSearchParams('from=2026-10-01&to=2026-11-15')), /31 days/);
  assert.throws(() => parseVisitWindow(new URLSearchParams('date=2026-10-01&from=2026-10-01&to=2026-10-02')), /not both/);
  assert.equal(parseResultLimit('80', { fallback: 20, max: 50 }), 50);
  assert.throws(() => parseResultLimit('0'), /at least 1/);
});

test('keeps the client-data key off the write dispatcher', () => {
  const env = { SPA_SYS_API_KEY: SECRET, CLIENT_DATA_API_KEY: NEXT_SECRET };
  assert.deepEqual(secretsForAccessMode('write', env), [SECRET]);
  assert.deepEqual(secretsForAccessMode('read', env), [SECRET, NEXT_SECRET]);
  assert.equal(CLIENT_DATA_API_INDEX.readOnly, true);
  assert.equal(SPA_SYS_API_INDEX.readOnly, false);
  assert.equal(CLIENT_DATA_API_INDEX.endpoints.every((endpoint) => endpoint.method === 'GET'), true);
  assert.equal(SPA_SYS_API_INDEX.endpoints.some((endpoint) => endpoint.method === 'PATCH'), true);
});

test('resolves only the documented read routes', () => {
  assert.equal(resolveClientDataRoute([]).kind, 'index');
  assert.equal(resolveClientDataRoute(['health']).kind, 'index');
  assert.equal(resolveClientDataRoute(['branches']).kind, 'branches');
  assert.equal(resolveClientDataRoute(['clients']).kind, 'clients');
  assert.deepEqual(resolveClientDataRoute(['clients', 'abc123']), { kind: 'client', clientId: 'abc123' });
  assert.equal(resolveClientDataRoute(['clients', 'abc123', 'check-ins']).kind, 'client-check-ins');
  assert.equal(resolveClientDataRoute(['check-ins']).kind, 'check-ins');
  assert.equal(resolveClientDataRoute(['check-outs']).kind, 'check-outs');
  assert.deepEqual(resolveClientDataRoute(['check-ins', 'visit1', 'checkout']), { kind: 'check-in-checkout', visitId: 'visit1' });
  assert.equal(resolveClientDataRoute(['clients', 'abc', 'notes']).kind, 'not-found');
});

test('accepts a partial client update and keeps a full date as month and day', () => {
  const changes = clientUpdateChanges({
    name: 'Amina Nakato',
    phone: '256782000000',
    dateOfBirth: '1990-03-15',
    nextOfKin: 'ignored',
  });
  assert.equal(changes.name, 'Amina Nakato');
  assert.deepEqual(changes.phoneNumbers, ['0782000000']);
  assert.equal(changes.birthMonth, 3);
  assert.equal(changes.birthDay, 15);
  assert.equal('nextOfKin' in changes, false);
  assert.equal(JSON.stringify(changes).includes('1990'), false);
  assert.throws(() => clientUpdateChanges({ nextOfKin: 'only' }), /name, phone number, or birthday/);
  assert.throws(() => clientUpdateChanges({ dateOfBirth: '1990-02-31' }), /valid birthday/);
});

test('returns birthday month and day and does not treat the stored year as a birth year', () => {
  const profile = serializeClientProfile('client1', {
    name: 'Amina Nakato',
    phoneNumber: '256782000000, 0758000000',
    phoneNumbers: ['0782000000'],
    birthMonth: 3,
    birthDay: 15,
    dateOfBirth: { toDate: () => new Date('2026-03-15T00:00:00Z') },
    branch: 'Kololo',
    createdAt: { toDate: () => new Date('2024-05-01T09:00:00Z') },
    nextOfKin: 'Should stay in SpaGym',
    notes: 'private staff note',
  });
  assert.equal(profile.name, 'Amina Nakato');
  assert.deepEqual(profile.phoneNumbers, ['0782000000', '0758000000']);
  assert.deepEqual(profile.dateOfBirth, {
    month: 3,
    day: 15,
    monthName: 'March',
    monthDay: '03-15',
    year: null,
  });
  assert.equal(JSON.stringify(profile).includes('2026'), false);
  assert.equal(JSON.stringify(profile).includes('Should stay'), false);
  assert.equal(JSON.stringify(profile).includes('private staff note'), false);
  assert.equal(profile.createdAt, '2024-05-01T09:00:00.000Z');
});

test('reports an open visit, a recorded departure, and the 12-hour automatic departure', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const open = serializeCheckIn('visit-open', {
    clientId: 'client1',
    clientName: 'Amina Nakato',
    phoneNumber: '0782000000',
    birthMonth: 3,
    birthDay: 15,
    checkedInBranch: 'Kololo',
    visitDate: '2026-10-24',
    checkedInAt: { toMillis: () => now.getTime() - 60 * 60 * 1000 },
  }, now);
  assert.equal(open.status, 'checked-in');
  assert.equal(open.checkedOutAt, null);

  const recorded = serializeCheckIn('visit-out', {
    checkedInAt: '2026-10-24T08:00:00Z',
    checkedOutAt: '2026-10-24T09:15:00Z',
    checkedOutBy: 'Front desk',
  }, now);
  assert.equal(recorded.status, 'checked-out');
  assert.equal(recorded.checkedOutBy, 'Front desk');
  assert.equal(recorded.checkedOutAt, '2026-10-24T09:15:00.000Z');

  const checkedInAt = now.getTime() - 13 * 60 * 60 * 1000;
  const expired = serializeCheckIn('visit-expired', { checkedInAt: { toMillis: () => checkedInAt } }, now);
  assert.equal(expired.status, 'checked-out');
  assert.equal(expired.checkedOutBy, 'Automatic (12-hour timeout)');
  assert.equal(expired.checkedOutAt, new Date(checkedInAt + 12 * 60 * 60 * 1000).toISOString());
});

test('matches check-ins when the caller uses another accepted phone format', () => {
  assert.equal(visitMatchesPhone('0782000000, 0758000000', ['0782000000']), true);
  assert.equal(visitMatchesPhone('0782000000', ['256782000000']), true);
  assert.equal(visitMatchesPhone('0782000000', ['0758000000']), false);
});
