import { createHmac, timingSafeEqual } from 'node:crypto';

const API_PREFIX = '/api/spa-sys/v1';
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

export class SpaGymApiError extends Error {
  constructor({ status = 0, code = 'REQUEST_FAILED', message = 'SpaGym request failed.', retryAfterSeconds = 0 } = {}) {
    super(message);
    this.name = 'SpaGymApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeSpaGymOrigin(value) {
  const text = String(value || '').trim();
  if (!text) {
    throw new SpaGymApiError({
      code: 'CONFIG',
      message: 'Set SPAGYM_API_URL to the SpaGym origin, for example https://spagym.example.',
    });
  }
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new SpaGymApiError({ code: 'CONFIG', message: 'SPAGYM_API_URL must be an absolute URL.' });
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new SpaGymApiError({ code: 'CONFIG', message: 'SPAGYM_API_URL must be the origin only. Do not put the API key in the URL.' });
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new SpaGymApiError({ code: 'CONFIG', message: 'SPAGYM_API_URL is the SpaGym origin only. Do not include /api.' });
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !local) {
    throw new SpaGymApiError({ code: 'CONFIG', message: 'SPAGYM_API_URL must use HTTPS.' });
  }
  return url.origin;
}

function assertApiKey(apiKey) {
  const key = String(apiKey || '');
  if (key.length < 32 || /\s/.test(key)) {
    throw new SpaGymApiError({
      code: 'CONFIG',
      message: 'Set SPA_SYS_API_KEY to the same secret as SpaGym. Use at least 32 characters and no spaces.',
    });
  }
  return key;
}

function assertClientId(clientId) {
  const id = String(clientId || '');
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(id)) {
    throw new SpaGymApiError({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid client id.' });
  }
  return id;
}

async function readBody(response) {
  const text = typeof response.text === 'function' ? await response.text() : '';
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function headerValue(response, name) {
  const headers = response.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || '';
  return headers[name] || headers[name.toLowerCase()] || '';
}

export function verifySpaSysWebhook({ secret, timestamp, rawBody, signature, now = Date.now(), toleranceSeconds = 300 } = {}) {
  const stamp = Number(timestamp);
  const presented = String(signature || '').replace(/^sha256=/i, '').toLowerCase();
  if (!secret || !Number.isFinite(stamp) || Math.abs(now - stamp * 1000) > toleranceSeconds * 1000) return false;
  if (!/^[a-f0-9]{64}$/.test(presented)) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(presented, 'hex'));
}

export function createSpaGymClient({
  baseUrl = process.env.SPAGYM_API_URL,
  apiKey = process.env.SPA_SYS_API_KEY || process.env.SPAGYM_CLIENT_DATA_API_KEY,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  maxRetries = 2,
  timeoutMs = 15000,
} = {}) {
  const origin = normalizeSpaGymOrigin(baseUrl);
  const key = assertApiKey(apiKey);
  if (typeof fetchImpl !== 'function') {
    throw new SpaGymApiError({ code: 'CONFIG', message: 'This client needs a fetch implementation. Use Node.js 18 or newer.' });
  }

  async function request(path, query = {}, { method = 'GET', jsonBody, retryServerErrors = method === 'GET' } = {}) {
    const url = new URL(`${API_PREFIX}${path}`, origin);
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
    }
    const retryable = retryServerErrors ? RETRYABLE_STATUSES : new Set([502, 503, 504]);
    let attempt = 0;
    let honoredRateLimit = false;
    while (true) {
      let response;
      try {
        response = await fetchImpl(url, {
          method,
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: 'application/json',
            ...(jsonBody === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          body: jsonBody === undefined ? undefined : JSON.stringify(jsonBody),
          cache: 'no-store',
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        if (attempt >= maxRetries) {
          throw new SpaGymApiError({ code: 'NETWORK', message: 'SpaGym could not be reached.' });
        }
        attempt += 1;
        await sleep(250 * attempt);
        continue;
      }
      if (response.status === 429 && !honoredRateLimit) {
        honoredRateLimit = true;
        const retryAfter = Number(headerValue(response, 'retry-after'));
        await readBody(response);
        const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) : 1;
        await sleep(seconds * 1000);
        continue;
      }
      if (retryable.has(response.status) && attempt < maxRetries) {
        attempt += 1;
        await readBody(response);
        await sleep(250 * attempt);
        continue;
      }
      const body = await readBody(response);
      if (!response.ok) {
        const retryAfter = Number(headerValue(response, 'retry-after'));
        throw new SpaGymApiError({
          status: response.status,
          code: body.error?.code || 'REQUEST_FAILED',
          message: body.error?.message || 'SpaGym request failed.',
          retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : 0,
        });
      }
      return body;
    }
  }

  return {
    async ping() {
      return request('');
    },
    async listBranches() {
      const body = await request('/branches');
      return body.branches || [];
    },
    async findClients({ phone = '', search = '', limit } = {}) {
      const phoneText = String(phone || '').trim();
      const term = String(search || '').trim();
      if (phoneText && term) {
        throw new SpaGymApiError({ status: 400, code: 'VALIDATION_ERROR', message: 'Provide either phone or search, not both.' });
      }
      if (!phoneText && term.length < 2) {
        throw new SpaGymApiError({ status: 400, code: 'VALIDATION_ERROR', message: 'Provide a phone number or at least two characters of a name.' });
      }
      return request('/clients', { phone: phoneText, search: term, limit });
    },
    async getClient(clientId) {
      const body = await request(`/clients/${encodeURIComponent(assertClientId(clientId))}`);
      return body.client;
    },
    async listCheckIns({ date, from, to, branch, phone, clientId } = {}) {
      return request('/check-ins', { date, from, to, branch, phone, clientId });
    },
    async listClientCheckIns(clientId, { date, from, to } = {}) {
      return request(`/clients/${encodeURIComponent(assertClientId(clientId))}/check-ins`, { date, from, to });
    },
    async updateClient(clientId, changes) {
      const body = await request(`/clients/${encodeURIComponent(assertClientId(clientId))}`, {}, { method: 'PATCH', jsonBody: changes, retryServerErrors: false });
      return body.client;
    },
    async updateClientByPhone(phone, changes) {
      const body = await request('/clients', { phone }, { method: 'PATCH', jsonBody: changes, retryServerErrors: false });
      return body.client;
    },
    async checkOut({ visitId, phone, clientId, staffName } = {}) {
      return request('/check-outs', {}, { method: 'POST', jsonBody: { visitId, phone, clientId, staffName }, retryServerErrors: false });
    },
  };
}
