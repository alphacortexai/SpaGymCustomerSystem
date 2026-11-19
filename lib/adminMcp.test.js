import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  ADMIN_MCP_TOOLS,
  authorizationRedirect,
  concernSignals,
  connectPagePath,
  dispatchTool,
  handleMcpMessage,
  hashSecret,
  isAllowedRedirectUri,
  negotiateProtocol,
  originFromHeaders,
  parseAdminDateWindow,
  pkceMatches,
  presentBirthdays,
  presentCallerReports,
  presentCheckIns,
  presentClientCount,
  presentWrongFeedback,
  protectedResourceMetadata,
  readBearer,
  resolveBranchNames,
  substantiveFeedback,
  validateAuthorizeRequest,
  validateClientRegistration,
} from './adminMcp.js';

const BRANCHES = [{ id: 'kololo', name: 'Kololo' }, { id: 'bugolobi', name: 'Bugolobi' }];
const NOW = new Date('2026-11-15T10:00:00.000Z');

function data(overrides = {}) {
  return {
    listBranches: async () => BRANCHES,
    loadReports: async () => [],
    loadBirthdayClients: async () => [],
    loadVisits: async () => [],
    lookupClients: async () => [],
    countClients: async () => ({ total: 0, byBranch: [] }),
    ...overrides,
  };
}

test('today in Kampala is the default period', () => {
  const window = parseAdminDateWindow({}, NOW);
  assert.equal(window.from, '2026-11-15');
  assert.equal(window.to, '2026-11-15');
  assert.equal(window.timezone, 'Africa/Kampala');
});

test('a date range is inclusive and capped', () => {
  assert.equal(parseAdminDateWindow({ from: '2026-11-01', to: '2026-11-03' }, NOW).dates.length, 3);
  assert.throws(() => parseAdminDateWindow({ date: '2026-11-01', from: '2026-11-01', to: '2026-11-02' }, NOW), /either date/);
  assert.throws(() => parseAdminDateWindow({ from: '2026-02-31', to: '2026-03-01' }, NOW), /real calendar/);
  assert.throws(() => parseAdminDateWindow({ from: '2026-01-01', to: '2026-12-31' }, NOW), /92 days/);
  assert.equal(parseAdminDateWindow({ from: '2026-01-01', to: '2026-12-31' }, NOW, 366).dates.length, 365);
});

test('branch filters use the stored branch name', () => {
  assert.deepEqual(resolveBranchNames(['kololo', 'Bugolobi'], BRANCHES), ['Kololo', 'Bugolobi']);
  assert.throws(() => resolveBranchNames('Ntinda', BRANCHES), /Unknown branch: Ntinda/);
});

test('routine call reasons are not treated as wrong feedback', () => {
  const routine = '"Reason for Call : RECENT VISIT FEEDBACK"\nThe massage was lovely and the therapist was kind.';
  assert.equal(substantiveFeedback(routine), 'The massage was lovely and the therapist was kind.');
  assert.deepEqual(concernSignals(routine), []);
  assert.deepEqual(concernSignals('Nothing wrong, she was happy.'), []);
  const customOnly = presentWrongFeedback([{
    reportDateKey: '2026-11-15',
    callerName: 'Amina',
    branch: 'Kololo',
    previousDayVisits: [{ clientName: 'Peter', customFields: { Outcome: 'Locker was broken' } }],
  }]);
  assert.equal(customOnly.feedback[0].comment, 'Locker was broken');
  assert.equal(customOnly.feedback[0].concerning, true);
  assert.deepEqual(concernSignals('The room was dirty and the therapist was late. I want a refund.'), ['late', 'refund', 'dirty']);
});

test('wrong feedback keeps the caller, client, branch, and comment', () => {
  const result = presentWrongFeedback([
    {
      reportDateKey: '2026-11-14',
      callerName: 'Amina',
      branch: 'Kololo',
      previousDayVisits: [
        { clientName: 'Grace', phoneNumber: '0782000001', branch: 'Kololo', comment: 'Service was lovely.' },
        { clientName: 'Peter', phoneNumber: '0782000002', branch: 'Bugolobi', comment: 'The therapist was rude and I want a refund.' },
      ],
    },
  ], { branches: ['Bugolobi'] });
  assert.equal(result.matched, 1);
  assert.equal(result.feedback[0].callerName, 'Amina');
  assert.equal(result.feedback[0].clientName, 'Peter');
  assert.equal(result.feedback[0].branch, 'Bugolobi');
  assert.equal(result.feedback[0].concerning, true);
});

test('caller reports name the caller and keep every recorded detail', () => {
  const result = presentCallerReports([
    {
      reportDateKey: '2026-11-15',
      callerName: 'Amina',
      ownerName: 'Amina Nakato',
      branch: 'Kololo',
      notes: 'Called the morning list.',
      birthdayClients: [
        { clientName: 'Grace', phoneNumber: '0782000001', contactMethod: 'Call', comment: 'Sang happy birthday. She was pleased.' },
      ],
      previousDayVisits: [],
    },
    {
      reportDateKey: '2026-11-15',
      callerName: 'Daniel',
      branch: 'Bugolobi',
      birthdayClients: [],
    },
  ], { branch: 'Kololo' });
  assert.deepEqual(result.callers, ['Amina']);
  assert.equal(result.reports[0].sections[0].rows[0].contactMethod, 'Call');
  assert.equal(result.reports[0].feedback[0].concerning, false);
  assert.equal(result.reports[0].notes, 'Called the morning list.');
  assert.equal(result.reports[0].collaborated, false);
});

test('collaborated reports name the caller for each section and match either caller', () => {
  const report = {
    reportType: 'collaborated-report',
    reportDateKey: '2026-11-19',
    branch: 'Kololo',
    callerName: 'Alice',
    collaboration: {
      birthday: { callerId: 'caller-alice', callerName: 'Alice', userId: 'user-alice' },
      feedback: { callerId: 'caller-bob', callerName: 'Bob', userId: 'user-bob' },
    },
    birthdayClients: [{ clientName: 'Grace', comment: 'Sang happy birthday.' }],
    previousDayVisits: [{ clientName: 'Peter', comment: 'The locker was broken.' }],
  };
  const result = presentCallerReports([report], { caller: 'Bob' });
  assert.deepEqual(result.callers, ['Alice', 'Bob']);
  assert.equal(result.reports[0].collaborated, true);
  assert.equal(result.reports[0].birthdayHandler, 'Alice');
  assert.equal(result.reports[0].feedbackHandler, 'Bob');
  assert.equal(result.reports[0].sections[0].name, 'Birthday babies, handled by Alice');
  assert.equal(result.reports[0].sections[1].name, 'Feedback, handled by Bob');
  assert.equal(result.reports[0].feedback[1].concerning, true);
});

test('birthdays match month and day across a period', () => {
  const window = parseAdminDateWindow({ from: '2026-11-15', to: '2026-11-16' }, NOW, 366);
  const result = presentBirthdays([
    { id: '1', name: 'Grace', phoneNumber: '0782000001', branch: 'Kololo', birthMonth: 11, birthDay: 15 },
    { id: '2', name: 'Peter', phoneNumber: '0782000002', branch: 'Kololo', birthMonth: 11, birthDay: 20 },
    { id: '1', name: 'Grace', phoneNumber: '0782000001', branch: 'Kololo', birthMonth: 11, birthDay: 15 },
  ], window, 'Kololo');
  assert.equal(result.matched, 1);
  assert.equal(result.birthdays[0].birthday, '15 November');
  assert.deepEqual(result.birthdays[0].occursOn, ['2026-11-15']);
});

test('check-ins show who arrived, when, and who is still in', () => {
  const visits = [
    { id: 'v1', clientId: '1', name: 'Grace', phoneNumber: '0782000001', branch: 'Kololo', visitDate: '2026-11-15', status: 'checked-in', checkedInAt: '2026-11-15T06:30:00.000Z', checkedOutAt: null },
    { id: 'v2', clientId: '2', name: 'Peter', phoneNumber: '0782000002', branch: 'Kololo', visitDate: '2026-11-15', status: 'checked-out', checkedInAt: '2026-11-15T05:00:00.000Z', checkedOutAt: '2026-11-15T07:00:00.000Z', checkedOutBy: 'Front desk' },
  ];
  const open = presentCheckIns(visits, { openOnly: true });
  assert.equal(open.matched, 1);
  assert.equal(open.checkIns[0].name, 'Grace');
  assert.match(open.checkIns[0].checkedInAtKampala, /15 Nov 2026/);
  assert.match(open.checkIns[0].checkedInAtKampala, /EAT$/);
  const all = presentCheckIns(visits, { branch: 'Kololo' });
  assert.equal(all.matched, 2);
  assert.equal(all.checkIns[0].name, 'Grace');
});

test('client counts separate known branches from everyone else', () => {
  assert.deepEqual(presentClientCount({ total: 10, byBranch: [{ branch: 'Kololo', count: 4 }, { branch: 'Bugolobi', count: 5 }] }), {
    total: 10,
    byBranch: [{ branch: 'Bugolobi', count: 5 }, { branch: 'Kololo', count: 4 }],
    otherOrUnassigned: 1,
  });
});

test('tools answer the admin questions from the supplied records', async () => {
  const reports = [{
    reportDateKey: '2026-11-15',
    callerName: 'Amina',
    branch: 'Kololo',
    previousDayVisits: [{ clientName: 'Peter', phoneNumber: '0782000002', comment: 'There was a problem with the locker.' }],
  }];
  const source = data({
    loadReports: async () => reports,
    loadBirthdayClients: async (months) => {
      assert.deepEqual(months, [11]);
      return [{ id: '1', name: 'Grace', phoneNumber: '0782000001', branch: 'Kololo', birthMonth: 11, birthDay: 15 }];
    },
    loadVisits: async () => [{ id: 'v1', clientId: '1', name: 'Grace', phoneNumber: '0782000001', branch: 'Kololo', visitDate: '2026-11-15', status: 'checked-in', checkedInAt: '2026-11-15T06:30:00.000Z' }],
    lookupClients: async ({ phone }) => [{ id: '1', name: 'Grace', phoneNumber: phone }],
    countClients: async () => ({ total: 10, byBranch: [{ branch: 'Kololo', count: 4 }, { branch: 'Bugolobi', count: 5 }] }),
  });
  const feedback = await dispatchTool('list_wrong_feedback', { date: '2026-11-15', branches: ['Kololo'] }, source, NOW);
  assert.equal(feedback.feedback[0].clientName, 'Peter');
  const birthdays = await dispatchTool('list_birthdays', {}, source, NOW);
  assert.equal(birthdays.birthdays[0].name, 'Grace');
  const checkIns = await dispatchTool('list_check_ins', { openOnly: true }, source, NOW);
  assert.equal(checkIns.checkIns[0].status, 'checked-in');
  const callers = await dispatchTool('list_caller_reports', { date: '2026-11-15' }, source, NOW);
  assert.deepEqual(callers.callers, ['Amina']);
  const client = await dispatchTool('lookup_client', { phone: '0782000001' }, source, NOW);
  assert.equal(client.clients[0].name, 'Grace');
  const count = await dispatchTool('count_clients', {}, source, NOW);
  assert.equal(count.total, 10);
  await assert.rejects(dispatchTool('lookup_client', { phone: '0782000001', name: 'Grace' }, source, NOW), /not both/);
  await assert.rejects(dispatchTool('list_check_ins', { branch: 'Missing' }, source, NOW), /Unknown branch/);
});

test('the MCP handshake lists the admin tools and returns tool JSON', async () => {
  assert.equal(negotiateProtocol('2025-06-18'), '2025-06-18');
  assert.equal(negotiateProtocol('1999-01-01'), '2025-03-26');
  const listed = await handleMcpMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, data(), NOW);
  assert.equal(listed.body.result.tools.length, ADMIN_MCP_TOOLS.length);
  assert.deepEqual(listed.body.result.tools.map((tool) => tool.name), [
    'list_branches',
    'list_wrong_feedback',
    'list_birthdays',
    'lookup_client',
    'list_check_ins',
    'list_caller_reports',
    'count_clients',
  ]);
  const called = await handleMcpMessage({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'count_clients', arguments: {} },
  }, data({ countClients: async () => ({ total: 3, byBranch: [] }) }), NOW);
  assert.equal(JSON.parse(called.body.result.content[0].text).total, 3);
  assert.equal(called.body.result.isError, false);
  const missing = await handleMcpMessage({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'delete_client', arguments: {} },
  }, data(), NOW);
  assert.equal(missing.body.result.isError, true);
  const initialized = await handleMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, data(), NOW);
  assert.equal(initialized.notification, true);
  const bad = await handleMcpMessage({ jsonrpc: '2.0', id: 4, method: 'initialize' }, data(), NOW);
  assert.equal(bad.body.result.serverInfo.name, 'spagym-admin');
});

test('OAuth metadata, PKCE, and redirects stay on Grok', () => {
  assert.equal(readBearer('Bearer sgmcp_key_example'), 'sgmcp_key_example');
  assert.equal(originFromHeaders({
    url: 'http://internal/api/mcp',
    forwardedProto: 'https',
    forwardedHost: 'spa.example.com',
  }), 'https://spa.example.com');
  const metadata = protectedResourceMetadata('https://spa.example.com');
  assert.equal(metadata.resource, 'https://spa.example.com/api/mcp');
  assert.equal(isAllowedRedirectUri('https://grok.com/connectors/callback'), true);
  assert.equal(isAllowedRedirectUri('https://accounts.x.ai/oauth/callback'), true);
  assert.equal(isAllowedRedirectUri('https://evilgrok.com/callback'), false);
  assert.equal(isAllowedRedirectUri('https://grok.com.evil.com/callback'), false);
  assert.equal(isAllowedRedirectUri('http://localhost:3000/callback', 'development'), true);
  assert.equal(isAllowedRedirectUri('http://localhost:3000/callback', 'production'), false);
  const verifier = 'a'.repeat(43);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  assert.equal(pkceMatches(verifier, challenge), true);
  assert.equal(pkceMatches(`${verifier}x`, challenge), false);
  const registration = validateClientRegistration({
    client_name: 'Grok',
    redirect_uris: ['https://grok.com/callback', 'https://not-grok.example/callback'],
  });
  assert.equal(registration.ok, false);
  const client = { redirectUris: ['https://grok.com/callback'] };
  const approved = validateAuthorizeRequest({
    client_id: 'sgmcp_client_123',
    redirect_uri: 'https://grok.com/callback',
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'xyz',
  }, client);
  assert.equal(approved.ok, true);
  assert.equal(authorizationRedirect(approved.request.redirectUri, { code: 'sgmcp_code_123', state: 'xyz' }), 'https://grok.com/callback?code=sgmcp_code_123&state=xyz');
  assert.match(connectPagePath(approved.request), /^\/mcp\/connect\?/);
  assert.equal(hashSecret('same'), hashSecret('same'));
  assert.notEqual(hashSecret('same'), hashSecret('different'));
});
