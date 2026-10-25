import { keyFlags, SPA_SYS_REJECTED_FLAG } from './spaSysAccess.js';

const OPERATIONS = ['reads', 'updates', 'checkouts', 'other'];
const RESULTS = ['ok', 'clientError', 'serverError'];

export function shiftDateKey(day, amount) {
  const [year, month, date] = String(day || '').split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date + amount));
  if (Number.isNaN(utc.getTime())) return '';
  return utc.toISOString().slice(0, 10);
}

export function listDateKeys(from, to) {
  const days = [];
  let cursor = from;
  while (cursor && cursor <= to && days.length < 31) {
    days.push(cursor);
    cursor = shiftDateKey(cursor, 1);
  }
  return days;
}

export function classifySpaSysOperation(method, kind) {
  const verb = String(method || '').toUpperCase();
  if ((kind === 'client' || kind === 'clients') && verb === 'PATCH') return 'updates';
  if ((kind === 'check-outs' || kind === 'check-in-checkout') && verb === 'POST') return 'checkouts';
  if (verb === 'GET' && kind && kind !== 'not-found') return 'reads';
  return 'other';
}

export function statusBucket(status) {
  const code = Number(status) || 0;
  if (code >= 500) return 'serverError';
  if (code >= 400) return 'clientError';
  return 'ok';
}

export function usageDocId(kind, day, subjectId) {
  if (kind !== 'api' && kind !== 'webhook') return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return '';
  const subject = String(subjectId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  if (!subject) return '';
  return `${kind}_${day}_${subject}`;
}

export function webhookHost(value) {
  try {
    return new URL(String(value || '').trim()).host.slice(0, 120);
  } catch {
    return '';
  }
}

export function redactLogText(value) {
  return String(value || '')
    .replace(/\?[^\s]*/g, '')
    .replace(/\b\d{7,}\b/g, '[number]')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export function describeSpaSysRequest({ method, kind, hasPhone = false, hasSearch = false } = {}) {
  const verb = String(method || 'GET').toUpperCase();
  if (kind === 'index') return { request: 'Service index', path: 'GET /api/spa-sys/v1' };
  if (kind === 'branches') return { request: 'List branches', path: 'GET /api/spa-sys/v1/branches' };
  if (kind === 'clients' && verb === 'PATCH') return { request: 'Update by phone', path: 'PATCH /api/spa-sys/v1/clients' };
  if (kind === 'clients' && hasPhone) return { request: 'Read by phone', path: 'GET /api/spa-sys/v1/clients' };
  if (kind === 'clients' && hasSearch) return { request: 'Read by name', path: 'GET /api/spa-sys/v1/clients' };
  if (kind === 'clients') return { request: 'Read clients', path: 'GET /api/spa-sys/v1/clients' };
  if (kind === 'client' && verb === 'PATCH') return { request: 'Update client', path: 'PATCH /api/spa-sys/v1/clients/{id}' };
  if (kind === 'client') return { request: 'Read client', path: 'GET /api/spa-sys/v1/clients/{id}' };
  if (kind === 'client-check-ins') return { request: 'Read client check-ins', path: 'GET /api/spa-sys/v1/clients/{id}/check-ins' };
  if (kind === 'check-ins') return { request: 'List check-ins', path: 'GET /api/spa-sys/v1/check-ins' };
  if (kind === 'check-outs') return { request: 'Check out client', path: 'POST /api/spa-sys/v1/check-outs' };
  if (kind === 'check-in-checkout') return { request: 'Check out visit', path: 'POST /api/spa-sys/v1/check-ins/{id}/checkout' };
  return { request: 'Unknown request', path: `${verb} /api/spa-sys/v1` };
}

export function webhookFailureText(reason, status) {
  if (reason === 'rejected_url') return 'The webhook address was rejected.';
  if (reason === 'rejected_secret') return 'The webhook secret is not valid.';
  if (reason === 'network') return 'The other system could not be reached.';
  if (reason === 'not_configured') return '';
  if (Number(status)) return `The other system returned HTTP ${Number(status)}.`;
  return 'The check-in alert was not delivered.';
}

export function opaqueClientId(value) {
  const id = String(value || '');
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(id)) return '';
  if (/^\d{7,}$/.test(id)) return '';
  return id;
}

export function publicRequestLog(id, data = {}) {
  const status = Number(data.status) || 0;
  const success = data.success === true || (data.success !== false && status >= 200 && status < 400);
  return {
    id: String(id || ''),
    at: typeof data.at === 'string' ? data.at : null,
    channel: data.channel === 'webhook' ? 'webhook' : 'api',
    name: redactLogText(data.name).slice(0, 80) || 'Unrecognized',
    keyPreview: String(data.keyPreview || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12),
    source: data.source === 'environment' || data.source === 'registered' ? data.source : 'unrecognized',
    request: redactLogText(data.request).slice(0, 80) || 'Request',
    path: redactLogText(data.path).slice(0, 140),
    requestId: String(data.requestId || '').toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 32),
    clientId: opaqueClientId(data.clientId),
    success,
    status,
    errorCode: success ? '' : redactLogText(data.errorCode).slice(0, 40),
    errorMessage: success ? '' : redactLogText(data.errorMessage).slice(0, 180),
  };
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function blankKey(seed = {}) {
  return {
    subjectId: String(seed.subjectId || ''),
    name: String(seed.name || 'API key'),
    keyPreview: String(seed.keyPreview || ''),
    source: seed.source === 'environment' ? 'environment' : 'registered',
    status: String(seed.status || ''),
    requests: 0,
    reads: 0,
    updates: 0,
    checkouts: 0,
    other: 0,
    distinctLookups: 0,
    ok: 0,
    clientError: 0,
    serverError: 0,
    lastAt: null,
  };
}

function blankWebhook(seed = {}) {
  return {
    subjectId: String(seed.subjectId || ''),
    name: String(seed.name || 'Webhook'),
    host: String(seed.host || ''),
    delivered: 0,
    failed: 0,
    lastStatus: 0,
    lastReason: '',
    lastAt: null,
  };
}

function addCounts(target, row) {
  OPERATIONS.forEach((field) => { target[field] += number(row[field]); });
  RESULTS.forEach((field) => { target[field] += number(row[field]); });
  target.requests += number(row.requests);
  target.distinctLookups += number(row.distinctLookups);
  if (row.updatedAt && (!target.lastAt || String(row.updatedAt) > target.lastAt)) {
    target.lastAt = String(row.updatedAt);
    if (row.name) target.name = String(row.name);
    if (row.keyPreview) target.keyPreview = String(row.keyPreview);
  }
}

export function summarizeSpaSysUsage(rows = [], { from, to, integrations = [], environmentWebhookHost = '' } = {}) {
  const days = listDateKeys(from, to);
  const daySet = new Set(days);
  const keys = new Map();
  const webhooks = new Map();
  let rejected = 0;

  integrations.forEach((item) => {
    keys.set(item.id, blankKey({
      subjectId: item.id,
      name: item.name,
      keyPreview: item.keyPreview,
      source: 'registered',
      status: item.status,
    }));
    if (item.webhookUrl || item.webhookConfigured) {
      webhooks.set(item.id, blankWebhook({
        subjectId: item.id,
        name: item.name,
        host: webhookHost(item.webhookUrl),
      }));
    }
  });
  if (environmentWebhookHost) {
    webhooks.set('env', blankWebhook({ subjectId: 'env', name: 'Environment webhook', host: environmentWebhookHost }));
  }

  const apiDays = new Map(days.map((day) => [day, 0]));
  const webhookDays = new Map(days.map((day) => [day, { delivered: 0, failed: 0 }]));

  rows.forEach((row) => {
    if (!daySet.has(row.day)) return;
    if (row.kind === 'webhook') {
      const current = webhooks.get(row.subjectId) || blankWebhook(row);
      current.delivered += number(row.delivered);
      current.failed += number(row.failed);
      if (row.host) current.host = String(row.host);
      if (row.name) current.name = String(row.name);
      if (row.updatedAt && (!current.lastAt || String(row.updatedAt) > current.lastAt)) {
        current.lastAt = String(row.updatedAt);
        current.lastStatus = Number(row.lastStatus) || 0;
        current.lastReason = String(row.lastReason || '');
      }
      webhooks.set(row.subjectId, current);
      const bucket = webhookDays.get(row.day);
      bucket.delivered += number(row.delivered);
      bucket.failed += number(row.failed);
      return;
    }
    if (row.source === 'unrecognized' || row.subjectId === 'unrecognized') {
      rejected += number(row.requests);
      apiDays.set(row.day, apiDays.get(row.day) + number(row.requests));
      return;
    }
    const current = keys.get(row.subjectId) || blankKey(row);
    addCounts(current, row);
    keys.set(row.subjectId, current);
    apiDays.set(row.day, apiDays.get(row.day) + number(row.requests));
  });

  const keyRows = [...keys.values()].sort((left, right) => right.requests - left.requests || left.name.localeCompare(right.name));
  keyRows.forEach((item) => Object.assign(item, keyFlags(item)));
  const webhookRows = [...webhooks.values()].sort((left, right) => (right.delivered + right.failed) - (left.delivered + left.failed) || left.name.localeCompare(right.name));
  const sum = (list, field) => list.reduce((total, item) => total + item[field], 0);
  return {
    from,
    to,
    rejected,
    alerts: { rejectedBurst: rejected >= SPA_SYS_REJECTED_FLAG },
    api: {
      requests: sum(keyRows, 'requests') + rejected,
      ok: sum(keyRows, 'ok'),
      clientError: sum(keyRows, 'clientError'),
      serverError: sum(keyRows, 'serverError'),
      keys: keyRows,
      days: days.map((day) => ({ day, requests: apiDays.get(day) || 0 })),
    },
    webhooks: {
      delivered: sum(webhookRows, 'delivered'),
      failed: sum(webhookRows, 'failed'),
      targets: webhookRows,
      days: days.map((day) => ({ day, ...webhookDays.get(day) })),
    },
  };
}
