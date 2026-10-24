import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getServerFirestore } from '@/lib/firebase-server';
import { kampalaDateKey } from '@/lib/clientDataContract';
import {
  classifySpaSysOperation,
  statusBucket,
  summarizeSpaSysUsage,
  usageDocId,
  webhookHost,
} from '@/lib/spaSysActivity';

const COLLECTION = 'spaSysUsage';

function usageCollection() {
  return getServerFirestore().collection(COLLECTION);
}

function writeUsage(id, data) {
  if (!id) return Promise.resolve();
  return usageCollection().doc(id).set(data, { merge: true });
}

export function noteSpaSysRequest({ identity, status, operation, at = new Date() } = {}) {
  const day = kampalaDateKey(at);
  const subjectId = identity?.subjectId || 'unrecognized';
  const countedOperation = ['reads', 'updates', 'checkouts', 'other'].includes(operation) ? operation : 'other';
  const id = usageDocId('api', day, subjectId);
  writeUsage(id, {
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
  }).catch((error) => {
    console.error('SPA_SYS_API_V1 could not record API activity:', error?.message || 'Unknown error');
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

export function webhookAttempt(result, error) {
  if (error) return { delivered: false, status: 0, reason: 'network' };
  if (result?.delivered) return { delivered: true, status: Number(result.status) || 200, reason: 'delivered' };
  if (result?.reason) return { delivered: false, status: Number(result.status) || 0, reason: String(result.reason).slice(0, 40) };
  return { delivered: false, status: Number(result?.status) || 0, reason: result?.status ? `http_${result.status}` : 'failed' };
}

export { classifySpaSysOperation, webhookHost };
