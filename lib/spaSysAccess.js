import { createHash } from 'node:crypto';
import { CLIENT_DATA_RATE_WINDOW_MS, takeRateLimitToken } from './clientDataContract.js';
import { SPA_SYS_READ_SCOPES, SPA_SYS_SCOPES } from './spaSysScopes.js';

export const SPA_SYS_READ_LIMIT = 40;
export const SPA_SYS_WRITE_LIMIT = 30;
export const SPA_SYS_LOOKUP_LIMIT = 100;
export const SPA_SYS_LOOKUP_WINDOW_MS = 60 * 60 * 1000;
export const SPA_SYS_KEY_OVERLAP_MS = 24 * 60 * 60 * 1000;
export const SPA_SYS_LOOKUP_FLAG = 100;
export const SPA_SYS_READ_FLAG = 300;
export const SPA_SYS_UPDATE_FLAG = 40;
export const SPA_SYS_REJECTED_FLAG = 50;

export { SPA_SYS_READ_SCOPES, SPA_SYS_SCOPES };

function knownScopes(values) {
  const allowed = new Set(SPA_SYS_SCOPES);
  const scopes = [];
  values.forEach((item) => {
    const scope = String(item || '').trim();
    if (allowed.has(scope) && !scopes.includes(scope)) scopes.push(scope);
  });
  return scopes;
}

export function normalizeScopes(value, { whenMissing = 'all' } = {}) {
  if (value == null) {
    return { scopes: whenMissing === 'read' ? [...SPA_SYS_READ_SCOPES] : [...SPA_SYS_SCOPES] };
  }
  if (!Array.isArray(value)) return { error: 'Permissions must be a list.' };
  const scopes = knownScopes(value);
  if (!scopes.length) return { error: 'Choose at least one permission.' };
  return { scopes };
}

export function scopesFromEnvironment(value) {
  const text = String(value ?? '').trim();
  if (!text) return [...SPA_SYS_SCOPES];
  return knownScopes(text.split(','));
}

export function requiredScope({ kind, method, hasClient = false, hasPhone = false } = {}) {
  const verb = String(method || 'GET').toUpperCase();
  if (!kind || kind === 'index' || kind === 'not-found') return '';
  if (kind === 'branches') return verb === 'GET' ? 'branches:read' : '';
  if (kind === 'clients' || kind === 'client') {
    if (verb === 'PATCH') return 'clients:update';
    if (verb === 'GET') return 'clients:read';
    return '';
  }
  if (kind === 'client-check-ins') return verb === 'GET' ? 'checkins:read' : '';
  if (kind === 'check-ins') {
    if (verb !== 'GET') return '';
    return hasPhone || hasClient ? 'checkins:read' : 'checkins:register';
  }
  if (kind === 'check-outs' || kind === 'check-in-checkout') return verb === 'POST' ? 'checkouts:write' : '';
  return '';
}

export function scopeAllows(scopes, required) {
  if (!required) return true;
  return Array.isArray(scopes) && scopes.includes(required);
}

export function lookupSubject({ kind, method, clientId = '', phone = '', search = '', queryClientId = '' } = {}) {
  const verb = String(method || 'GET').toUpperCase();
  if ((kind === 'client' || kind === 'client-check-ins') && verb === 'GET') return String(clientId || '').trim();
  if (kind === 'clients' && verb === 'GET') return String(phone || search || '').trim();
  if (kind === 'check-ins' && verb === 'GET' && (phone || queryClientId)) return String(phone || queryClientId).trim();
  return '';
}

const defaultOperationBuckets = new Map();

export function consumeOperationQuota({
  keyId,
  operation,
  now = new Date(),
  buckets,
  windowMs = CLIENT_DATA_RATE_WINDOW_MS,
  readLimit = SPA_SYS_READ_LIMIT,
  writeLimit = SPA_SYS_WRITE_LIMIT,
} = {}) {
  const store = buckets || defaultOperationBuckets;
  const write = operation === 'updates' || operation === 'checkouts';
  const limit = write ? writeLimit : readLimit;
  const quota = takeRateLimitToken(store, `${write ? 'write' : 'read'}:${keyId || 'unknown'}`, now.getTime(), limit, windowMs);
  if (!quota.allowed) return { status: 429, retryAfterSeconds: quota.retryAfterSeconds };
  return { status: 200 };
}

export function lookupFingerprint(value) {
  return createHash('sha256').update(String(value || '').trim().toLowerCase()).digest('hex').slice(0, 16);
}

const defaultLookupBuckets = new Map();

export function takeDistinctLookup({
  keyId,
  fingerprint,
  now = new Date(),
  buckets,
  limit = SPA_SYS_LOOKUP_LIMIT,
  windowMs = SPA_SYS_LOOKUP_WINDOW_MS,
} = {}) {
  const store = buckets || defaultLookupBuckets;
  const nowMs = now.getTime();
  if (store.size > 2000) {
    for (const [bucketKey, entry] of store) {
      if (!entry || nowMs - entry.startedAt >= windowMs) store.delete(bucketKey);
    }
  }
  const key = String(keyId || 'unknown');
  const token = String(fingerprint || '');
  const current = store.get(key);
  if (!current || nowMs - current.startedAt >= windowMs) {
    store.set(key, { startedAt: nowMs, seen: new Set([token]) });
    return { status: 200, fresh: true };
  }
  if (current.seen.has(token)) return { status: 200, fresh: false };
  if (current.seen.size >= limit) {
    return {
      status: 429,
      fresh: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (nowMs - current.startedAt)) / 1000)),
    };
  }
  current.seen.add(token);
  return { status: 200, fresh: true };
}

function timeMs(value) {
  if (value == null || value === '') return NaN;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return parsed;
}

export function keyAccessState(data = {}, { now = new Date(), usingPrevious = false } = {}) {
  if (data.status === 'revoked') return 'revoked';
  const nowMs = now.getTime();
  const expires = timeMs(data.expiresAt);
  if (Number.isFinite(expires) && expires <= nowMs) return 'expired';
  if (usingPrevious) {
    const until = timeMs(data.previousKeyExpiresAt);
    if (!Number.isFinite(until) || until <= nowMs) return 'expired';
  }
  return 'active';
}

export function validateExpiresAt(value, now = new Date()) {
  if (value == null || String(value).trim() === '') return { expiresAt: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: 'Expiry must be a real date and time.' };
  if (date.getTime() < now.getTime() - 60 * 1000) return { error: 'Choose a future expiry or leave it empty.' };
  return { expiresAt: date.toISOString() };
}

export function keyFlags({ distinctLookups = 0, reads = 0, updates = 0 } = {}) {
  return {
    manyLookups: Number(distinctLookups) >= SPA_SYS_LOOKUP_FLAG || Number(reads) >= SPA_SYS_READ_FLAG,
    manyUpdates: Number(updates) >= SPA_SYS_UPDATE_FLAG,
  };
}
