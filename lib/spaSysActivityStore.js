import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getServerFirestore } from '@/lib/firebase-server';
import { kampalaDateKey } from '@/lib/clientDataContract';
import {
  classifySpaSysOperation,
  publicRequestLog,
  statusBucket,
  summarizeSpaSysUsage,
  usageDocId,
  webhookHost,
} from '@/lib/spaSysActivity';

const COLLECTION = 'spaSysUsage';
const LOG_COLLECTION = 'spaSysRequestLogs';

function usageCollection() {
  return getServerFirestore().collection(COLLECTION);
}

function writeUsage(id, data) {
  if (!id) return Promise.resolve();
  return usageCollection().doc(id).set(data, { merge: true });
}

export function noteSpaSysRequest({ identity, status, operation, distinctLookup = false, at = new Date() } = {}) {
  const day = kampalaDateKey(at);
  const subjectId = identity?.subjectId || 'unrecognized';
  const countedOperation = ['reads', 'updates', 'checkouts', 'other'].includes(operation) ? operation : 'other';
  const id = usageDocId('api', day, subjectId);
  const data = {
    day,
    subjectId,
    kind: 'api',
    name: String(identity?.name || 'Unrecognized').slice(0, 80),
    keyPreview: String(identity?.keyPreview || '').slice(0, 12),
    source: identity?.source === 'environment' || identity?.source === 'registered' ? identity.source : 'unrecognized',
    requests: FieldValue.increment(1),
    [countedOperation]: FieldValue.increment(1),
    [statusBucket(status)]: FieldValue.increment(1),
    lastStatus: Number(status) || 0,
    updatedAt: Timestamp.fromDate(at),
  };
  if (distinctLookup) data.distinctLookups = FieldValue.increment(1);
  writeUsage(id, data).catch((error) => {
    console.error('SPA_SYS_API_V1 could not record API activity:', error?.message || 'Unknown error');
  });
}

export function noteSpaSysRequestLog(entry = {}) {
  const at = entry.at instanceof Date ? entry.at : new Date();
  const view = publicRequestLog('', {
    ...entry,
    name: entry.identity?.name || entry.name,
    keyPreview: entry.identity?.keyPreview || entry.keyPreview,
    source: entry.identity?.source || entry.source,
    at: at.toISOString(),
  });
  const ref = getServerFirestore().collection(LOG_COLLECTION).doc();
  ref.set({
    ...view,
    id: ref.id,
    at: Timestamp.fromDate(at),
    day: kampalaDateKey(at),
  }).catch((error) => {
    console.error('SPA_SYS_API_V1 could not record a request log:', error?.message || 'Unknown error');
  });
}

export function noteSpaSysWebhook({ subjectId, name, host, delivered, status = 0, reason = '', at = new Date() } = {}) {
  const day = kampalaDateKey(at);
  const id = usageDocId('webhook', day, subjectId);
  writeUsage(id, {
    day,
    subjectId: String(subjectId || ''),
    kind: 'webhook',
    name: String(name || 'Webhook').slice(0, 80),
    host: String(host || '').slice(0, 120),
    delivered: FieldValue.increment(delivered ? 1 : 0),
    failed: FieldValue.increment(delivered ? 0 : 1),
    lastStatus: Number(status) || 0,
    lastReason: String(reason || (delivered ? 'delivered' : 'failed')).slice(0, 40),
    updatedAt: Timestamp.fromDate(at),
  }).catch((error) => {
    console.error('SPA_SYS_API_V1 could not record webhook activity:', error?.message || 'Unknown error');
  });
}

function iso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function loadSpaSysAnalytics({ from, to, integrations = [], environmentWebhookHost = '' }) {
  const snapshot = await usageCollection().where('day', '>=', from).where('day', '<=', to).limit(4000).get();
  const rows = snapshot.docs.map((item) => {
    const data = item.data();
    return { ...data, updatedAt: iso(data.updatedAt) };
  });
  const summary = summarizeSpaSysUsage(rows, { from, to, integrations, environmentWebhookHost });
  return { ...summary, truncated: snapshot.size >= 4000 };
}

export async function loadSpaSysRequestLogs({ from, to }) {
  const start = new Date(`${from}T00:00:00+03:00`);
  const end = new Date(`${to}T23:59:59.999+03:00`);
  const snapshot = await getServerFirestore().collection(LOG_COLLECTION)
    .where('at', '>=', Timestamp.fromDate(start))
    .where('at', '<=', Timestamp.fromDate(end))
    .orderBy('at', 'desc')
    .limit(200)
    .get();
  return {
    entries: snapshot.docs.map((item) => publicRequestLog(item.id, { ...item.data(), at: iso(item.data().at) })),
    truncated: snapshot.size >= 200,
  };
}

export function webhookAttempt(result, error) {
  if (error) return { delivered: false, status: 0, reason: 'network' };
  if (result?.delivered) return { delivered: true, status: Number(result.status) || 200, reason: 'delivered' };
  if (result?.reason) return { delivered: false, status: Number(result.status) || 0, reason: String(result.reason).slice(0, 40) };
  return { delivered: false, status: Number(result?.status) || 0, reason: result?.status ? `http_${result.status}` : 'failed' };
}

export { classifySpaSysOperation, webhookHost };
