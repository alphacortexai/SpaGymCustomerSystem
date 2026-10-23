import { createHash, timingSafeEqual } from 'node:crypto';
import { extractAllPhoneNumbers } from './phoneUtils.js';

export const CLIENT_DATA_KEY_MIN_LENGTH = 32;
export const CLIENT_DATA_RATE_WINDOW_MS = 60 * 1000;
export const CLIENT_DATA_FAILURE_LIMIT = 30;
export const CLIENT_DATA_SUCCESS_LIMIT = 120;
export const CLIENT_DATA_MAX_RANGE_DAYS = 31;
export const CLIENT_DATA_CHECK_IN_LIMIT = 500;
export const CLIENT_DATA_AUTO_CHECKOUT_AFTER_MS = 12 * 60 * 60 * 1000;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const CLIENT_DATA_API_INDEX = {
  service: 'spagym-client-data',
  version: 'v1',
  readOnly: true,
  dateOfBirth: 'Month and day only. SpaGym does not store a birth year.',
  endpoints: [
    { method: 'GET', path: '/api/integrations/client-data/v1/clients?phone={phone}' },
    { method: 'GET', path: '/api/integrations/client-data/v1/clients?search={name}&limit={1-50}' },
    { method: 'GET', path: '/api/integrations/client-data/v1/clients/{clientId}' },
    { method: 'GET', path: '/api/integrations/client-data/v1/clients/{clientId}/check-ins?from={YYYY-MM-DD}&to={YYYY-MM-DD}' },
    { method: 'GET', path: '/api/integrations/client-data/v1/check-ins?date={YYYY-MM-DD}&branch={branch}&phone={phone}' },
  ],
};

export function readConfiguredSecrets(envValue = '') {
  return String(envValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function secretsAreConfigured(secrets) {
  return secrets.length > 0 && secrets.every((secret) => secret.length >= CLIENT_DATA_KEY_MIN_LENGTH && !secret.includes(' '));
}

export function rejectsCleartext({ forwardedProto = '', nodeEnv = 'production' } = {}) {
  if (nodeEnv !== 'production') return false;
  const proto = String(forwardedProto || '').split(',')[0].trim().toLowerCase();
  return proto === 'http';
}

export function credentialsMatch(presented, secrets) {
  const provided = Buffer.from(String(presented || ''));
  let matched = false;
  for (const secret of secrets) {
    const expected = Buffer.from(secret);
    if (expected.length === provided.length) {
      matched = timingSafeEqual(expected, provided) || matched;
    } else if (expected.length > 0) {
      timingSafeEqual(expected, expected);
    }
  }
  return matched;
}

export function authorizePresentedKey(presented, secrets) {
  if (!secretsAreConfigured(secrets)) return { ok: false, reason: 'unconfigured' };
  const key = String(presented || '');
  if (!key || key.length > 256) return { ok: false, reason: 'unauthorized' };
  if (!credentialsMatch(key, secrets)) return { ok: false, reason: 'unauthorized' };
  return {
    ok: true,
    keyId: createHash('sha256').update(key).digest('hex').slice(0, 16),
  };
}

export function takeRateLimitToken(buckets, key, nowMs, limit, windowMs) {
  const recent = (buckets.get(key) || []).filter((stamp) => nowMs - stamp < windowMs);
  if (buckets.size > 2000) {
    for (const [bucketKey, stamps] of buckets) {
      if (stamps.every((stamp) => nowMs - stamp >= windowMs)) buckets.delete(bucketKey);
    }
  }
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (nowMs - recent[0])) / 1000)),
    };
  }
  recent.push(nowMs);
  buckets.set(key, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function assessClientDataAccess({
  presentedKey,
  secrets,
  address = 'unknown',
  now = new Date(),
  authFailures,
  acceptedRequests,
  failureLimit = CLIENT_DATA_FAILURE_LIMIT,
  successLimit = CLIENT_DATA_SUCCESS_LIMIT,
  windowMs = CLIENT_DATA_RATE_WINDOW_MS,
}) {
  const failures = authFailures || defaultAuthFailures;
  const accepted = acceptedRequests || defaultAcceptedRequests;
  const nowMs = now.getTime();
  const decision = authorizePresentedKey(presentedKey, secrets);
  if (!decision.ok) {
    const ip = takeRateLimitToken(failures, `ip:${address || 'unknown'}`, nowMs, failureLimit, windowMs);
    const fingerprint = createHash('sha256').update(String(presentedKey || '')).digest('hex').slice(0, 16);
    const key = takeRateLimitToken(failures, `failkey:${fingerprint}`, nowMs, failureLimit, windowMs);
    if (!ip.allowed || !key.allowed) {
      return { status: 429, retryAfterSeconds: Math.max(ip.retryAfterSeconds, key.retryAfterSeconds) };
    }
    return { status: 401, reason: decision.reason };
  }
  const quota = takeRateLimitToken(accepted, `key:${decision.keyId}`, nowMs, successLimit, windowMs);
  if (!quota.allowed) {
    return { status: 429, retryAfterSeconds: quota.retryAfterSeconds, keyId: decision.keyId };
  }
  return { status: 200, keyId: decision.keyId };
}

const defaultAuthFailures = new Map();
const defaultAcceptedRequests = new Map();

export function kampalaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function eachDate(from, to) {
  const dates = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function parseVisitWindow(searchParams, now = new Date()) {
  const date = String(searchParams.get('date') || '').trim();
  const from = String(searchParams.get('from') || '').trim();
  const to = String(searchParams.get('to') || '').trim();
  if (date && (from || to)) {
    throw new ContractError(400, 'Use either date or from and to, not both.');
  }
  if ((from && !to) || (!from && to)) {
    throw new ContractError(400, 'Provide both from and to.');
  }
  if (date) {
    if (!isRealDate(date)) throw new ContractError(400, 'date must be a real calendar date in YYYY-MM-DD format.');
    return { from: date, to: date, dates: [date] };
  }
  if (!from && !to) {
    const today = kampalaDateKey(now);
    return { from: today, to: today, dates: [today] };
  }
  if (!isRealDate(from) || !isRealDate(to)) {
    throw new ContractError(400, 'from and to must be real calendar dates in YYYY-MM-DD format.');
  }
  if (from > to) throw new ContractError(400, 'from must be on or before to.');
  const dates = eachDate(from, to);
  if (dates.length > CLIENT_DATA_MAX_RANGE_DAYS) {
    throw new ContractError(400, `A check-in query can cover at most ${CLIENT_DATA_MAX_RANGE_DAYS} days.`);
  }
  return { from, to, dates };
}

export function parseResultLimit(value, { fallback = 20, max = 50 } = {}) {
  if (value == null || value === '') return fallback;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) throw new ContractError(400, 'limit must be a whole number.');
  const parsed = Number(text);
  if (parsed < 1) throw new ContractError(400, 'limit must be at least 1.');
  return Math.min(parsed, max);
}

export function assertClientId(clientId) {
  const id = String(clientId || '');
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(id)) throw new ContractError(400, 'Invalid client id.');
  return id;
}

export function resolveClientDataRoute(resource = []) {
  const parts = Array.isArray(resource) ? resource : [];
  if (parts.length === 0 || (parts.length === 1 && parts[0] === 'health')) return { kind: 'index' };
  if (parts.length === 1 && parts[0] === 'clients') return { kind: 'clients' };
  if (parts.length === 2 && parts[0] === 'clients') return { kind: 'client', clientId: parts[1] };
  if (parts.length === 3 && parts[0] === 'clients' && parts[2] === 'check-ins') {
    return { kind: 'client-check-ins', clientId: parts[1] };
  }
  if (parts.length === 1 && parts[0] === 'check-ins') return { kind: 'check-ins' };
  return { kind: 'not-found' };
}

function timestampMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function asIso(value) {
  const millis = timestampMillis(value);
  return millis == null ? null : new Date(millis).toISOString();
}

export function serializeDateOfBirth(data = {}) {
  const month = Number(data.birthMonth);
  const day = Number(data.birthDay);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  const probe = new Date(Date.UTC(2000, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return {
    month,
    day,
    monthName: MONTHS[month - 1],
    monthDay: `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    // SpaGym stores the calendar year on dateOfBirth as a placeholder, so the year is never a birth year.
    year: null,
  };
}

function phoneList(data = {}) {
  const stored = Array.isArray(data.phoneNumbers) ? data.phoneNumbers : [];
  const parsed = extractAllPhoneNumbers(data.phoneNumber || '');
  const phones = [];
  for (const phone of [...stored, ...parsed]) {
    const normalized = extractAllPhoneNumbers(phone)[0];
    if (normalized && !phones.includes(normalized)) phones.push(normalized);
  }
  return phones;
}

export function serializeClientProfile(id, data = {}) {
  const phoneNumbers = phoneList(data);
  return {
    id,
    name: String(data.name || ''),
    phoneNumber: String(data.phoneNumber || phoneNumbers.join(', ')),
    phoneNumbers,
    dateOfBirth: serializeDateOfBirth(data),
    branch: String(data.branch || ''),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
  };
}

export function serializeCheckIn(id, data = {}, now = new Date(), autoCheckoutAfterMs = CLIENT_DATA_AUTO_CHECKOUT_AFTER_MS) {
  const checkedInMs = timestampMillis(data.checkedInAt);
  let checkedOutMs = timestampMillis(data.checkedOutAt);
  let checkedOutBy = String(data.checkedOutBy || '');
  if (checkedOutMs == null && checkedInMs != null && now.getTime() >= checkedInMs + autoCheckoutAfterMs) {
    checkedOutMs = checkedInMs + autoCheckoutAfterMs;
    checkedOutBy = checkedOutBy || 'Automatic (12-hour timeout)';
  }
  return {
    id,
    clientId: String(data.clientId || ''),
    name: String(data.clientName || data.name || ''),
    phoneNumber: String(data.phoneNumber || ''),
    phoneNumbers: phoneList(data),
    dateOfBirth: serializeDateOfBirth(data),
    branch: String(data.checkedInBranch || data.branch || ''),
    visitDate: String(data.visitDate || ''),
    checkedInAt: checkedInMs == null ? null : new Date(checkedInMs).toISOString(),
    checkedOutAt: checkedOutMs == null ? null : new Date(checkedOutMs).toISOString(),
    checkedOutBy,
    status: checkedOutMs == null ? 'checked-in' : 'checked-out',
  };
}

export function visitMatchesPhone(phoneNumber, wantedNumbers) {
  const have = extractAllPhoneNumbers(phoneNumber);
  const wanted = wantedNumbers.flatMap((phone) => extractAllPhoneNumbers(phone));
  return wanted.some((phone) => have.includes(phone));
}

export class ContractError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
