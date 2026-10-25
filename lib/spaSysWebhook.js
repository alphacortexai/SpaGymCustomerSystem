import { createHmac } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', '0.0.0.0', '::', '::1']);

export function signSpaSysWebhook({ secret, timestamp, body }) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

function isPrivateIpv4(host) {
  const match = String(host || '').match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [first, second] = parts;
  if (first === 10 || first === 127 || first === 0) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return false;
}

function isPrivateIpv6(host) {
  const value = String(host || '').toLowerCase();
  if (value === '::' || value === '::1') return true;
  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  const first = Number.parseInt(value.split(':')[0] || '0', 16);
  if (!Number.isFinite(first)) return true;
  if (first >= 0xfe80 && first <= 0xfebf) return true;
  if (first >= 0xfc00 && first <= 0xfdff) return true;
  return false;
}

function isPrivateAddress(hostname) {
  const host = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host.includes(':')) return isPrivateIpv6(host);
  if (isPrivateIpv4(host)) return true;
  return false;
}

export function addressesArePublic(records) {
  const list = Array.isArray(records) ? records : [records];
  if (!list.length || list.some((item) => !item)) return false;
  return list.every((item) => {
    const address = typeof item === 'string' ? item : item.address;
    return address && !isPrivateAddress(address);
  });
}

async function hostnameResolvesPublic(hostname, lookupImpl) {
  const host = String(hostname || '').replace(/^\[|\]$/g, '');
  if (isPrivateAddress(host)) return false;
  const literal = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':');
  if (literal) return true;
  try {
    const records = await lookupImpl(host, { all: true, verbatim: true });
    return addressesArePublic(records);
  } catch {
    return false;
  }
}

export function webhookTargetIsAllowed(value, nodeEnv = 'production') {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol === 'http:' && local && nodeEnv !== 'production') return true;
  if (url.protocol !== 'https:') return false;
  if (isPrivateAddress(url.hostname)) return false;
  return true;
}

export function buildCheckInAlert({ client = {}, visit = {}, sentAt }) {
  const month = Number(client.birthMonth) || null;
  const day = Number(client.birthDay) || null;
  return {
    event: 'client.checked_in',
    api: 'SPA_SYS_API_V1',
    sentAt,
    client: {
      id: String(client.id || visit.clientId || ''),
      name: String(client.name || visit.name || ''),
      phoneNumber: String(client.phoneNumber || client.phone || visit.phoneNumber || visit.phone || ''),
      dateOfBirth: month && day ? { month, day, year: null } : { month: month || null, day: day || null, year: null },
      branch: String(client.branch || client.registeredBranch || ''),
    },
    checkIn: {
      id: String(visit.id || ''),
      clientId: String(visit.clientId || client.id || ''),
      branch: String(visit.checkedInBranch || visit.branch || ''),
      visitDate: String(visit.visitDate || ''),
      checkedInAt: visit.checkedInAt || null,
      status: 'checked-in',
    },
  };
}

export async function deliverCheckInAlert({
  payload,
  env = process.env,
  fetchImpl = globalThis.fetch,
  lookupImpl = dnsLookup,
  now = new Date(),
} = {}) {
  const url = String(env.SPA_SYS_WEBHOOK_URL || '').trim();
  if (!url) return { delivered: false, reason: 'not_configured' };
  const secret = String(env.SPA_SYS_WEBHOOK_SECRET || '');
  if (!webhookTargetIsAllowed(url, env.NODE_ENV)) return { delivered: false, reason: 'rejected_url' };
  const hostname = new URL(url).hostname;
  const localDev = env.NODE_ENV !== 'production' && (hostname === 'localhost' || hostname === '127.0.0.1');
  if (!localDev && !(await hostnameResolvesPublic(hostname, lookupImpl))) return { delivered: false, reason: 'rejected_url' };
  if (secret.trim().length < 32 || /\s/.test(secret.trim())) return { delivered: false, reason: 'rejected_secret' };
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const signature = signSpaSysWebhook({ secret: secret.trim(), timestamp, body });
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'SPA_SYS_API_V1',
      'X-Spa-Sys-Event': 'client.checked_in',
      'X-Spa-Sys-Delivery': String(payload?.checkIn?.id || ''),
      'X-Spa-Sys-Timestamp': timestamp,
      'X-Spa-Sys-Signature': `sha256=${signature}`,
    },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  return { delivered: response.ok === true, status: response.status };
}
