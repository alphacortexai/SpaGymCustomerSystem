import { NextResponse } from 'next/server';
import { ApiError, listBranches } from '@/lib/guestflowApi';
import { checkOutClient, getClientProfile, queryClientProfiles, queryVisitRegister, updateClientProfile } from '@/lib/clientDataApi';
import {
  ContractError,
  SPA_SYS_API_INDEX,
  assessClientDataAccess,
  clientUpdateChanges,
  parseResultLimit,
  parseVisitWindow,
  readConfiguredSecrets,
  rejectsCleartext,
  resolveClientDataRoute,
  secretsAreConfigured,
} from '@/lib/clientDataContract';

let loggedConfiguration = false;

function json(data, status = 200, extraHeaders = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
      ...extraHeaders,
    },
  });
}

function errorBody(code, message) {
  return { error: { code, message } };
}

function requestAddress(request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0].trim();
  return (first || request.headers.get('x-real-ip') || 'unknown').slice(0, 80);
}

function presentedKey(request) {
  const authorization = request.headers.get('authorization') || '';
  let bearer = '';
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(\S+)\s*$/i);
    if (!match) return { error: 'Authorization must be a Bearer token.' };
    bearer = match[1];
  }
  const headerKey = (request.headers.get('x-api-key') || '').trim();
  if (bearer && headerKey && bearer !== headerKey) return { error: 'Authorization and X-Api-Key do not match.' };
  return { key: bearer || headerKey };
}

function configuredSecrets() {
  const secrets = readConfiguredSecrets([process.env.SPA_SYS_API_KEY, process.env.CLIENT_DATA_API_KEY].filter(Boolean).join(','));
  if (!loggedConfiguration && !secretsAreConfigured(secrets)) {
    loggedConfiguration = true;
    console.error('SPA_SYS_API_KEY is missing, contains spaces, or is shorter than 32 characters. SPA_SYS_API_V1 will reject every request.');
  }
  return secrets;
}

function authorize(request) {
  const presented = presentedKey(request);
  const decision = assessClientDataAccess({
    presentedKey: presented.error ? '' : presented.key,
    secrets: configuredSecrets(),
    address: requestAddress(request),
  });
  if (decision.status === 429) {
    return json(errorBody('RATE_LIMITED', 'Too many requests. Try again later.'), 429, {
      'Retry-After': String(decision.retryAfterSeconds),
    });
  }
  if (decision.status !== 200) return json(errorBody('UNAUTHORIZED', presented.error || 'Unauthorized.'), 401);
  return null;
}

function rejectCleartext(request) {
  if (!rejectsCleartext({ forwardedProto: request.headers.get('x-forwarded-proto') || '', nodeEnv: process.env.NODE_ENV })) return null;
  return json(errorBody('HTTPS_REQUIRED', 'SPA_SYS_API_V1 requests must use HTTPS.'), 400);
}

function allowedMethods(kind) {
  if (kind === 'clients' || kind === 'client') return 'GET, PATCH';
  if (kind === 'check-outs' || kind === 'check-in-checkout') return 'POST';
  return 'GET';
}

async function readJson(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > 16000) throw new ContractError(400, 'Request body is too large.');
  const text = await request.text();
  if (text.length > 16000) throw new ContractError(400, 'Request body is too large.');
  if (!text.trim()) return {};
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ContractError(400, 'Request body must be a JSON object.');
    return body;
  } catch (error) {
    if (error instanceof ContractError) throw error;
    throw new ContractError(400, 'Request body must be valid JSON.');
  }
}

export async function dispatch(request, context) {
  const cleartext = rejectCleartext(request);
  if (cleartext) return cleartext;
  const rejected = authorize(request);
  if (rejected) return rejected;

  try {
    const { resource = [] } = await context.params;
    const route = resolveClientDataRoute(resource);
    const method = request.method;
    const allowed = allowedMethods(route.kind);
    if (route.kind !== 'not-found' && !allowed.split(', ').includes(method)) {
      return json(errorBody('METHOD_NOT_ALLOWED', 'This method is not allowed for this endpoint.'), 405, { Allow: allowed });
    }
    const url = new URL(request.url);

    if (route.kind === 'index' && method === 'GET') return json(SPA_SYS_API_INDEX);
    if (route.kind === 'branches' && method === 'GET') return json({ branches: await listBranches() });
    if (route.kind === 'clients' && method === 'GET') {
      const clients = await queryClientProfiles({
        phone: url.searchParams.get('phone') || '',
        search: url.searchParams.get('search') || '',
        limit: parseResultLimit(url.searchParams.get('limit'), { fallback: 20, max: 50 }),
      });
      return json({ count: clients.length, clients });
    }
    if (route.kind === 'clients' && method === 'PATCH') {
      const phone = url.searchParams.get('phone') || '';
      if (!phone) return json(errorBody('VALIDATION_ERROR', 'Updating by phone requires the phone query parameter.'), 400);
      const matches = await queryClientProfiles({ phone, limit: 10 });
      if (!matches.length) return json(errorBody('CLIENT_NOT_FOUND', 'No client record matches that phone number.'), 404);
      if (matches.length > 1) return json(errorBody('AMBIGUOUS_CLIENT', 'More than one client has that phone number. Update by client id.'), 409);
      const client = await updateClientProfile(matches[0].id, clientUpdateChanges(await readJson(request)));
      if (!client) return json(errorBody('CLIENT_NOT_FOUND', 'No client record matches that phone number.'), 404);
      return json({ client });
    }
    if (route.kind === 'client' && method === 'GET') {
      const client = await getClientProfile(route.clientId);
      if (!client) return json(errorBody('CLIENT_NOT_FOUND', 'No client record matches that id.'), 404);
      return json({ client });
    }
    if (route.kind === 'client' && method === 'PATCH') {
      const client = await updateClientProfile(route.clientId, clientUpdateChanges(await readJson(request)));
      if (!client) return json(errorBody('CLIENT_NOT_FOUND', 'No client record matches that id.'), 404);
      return json({ client });
    }
    if (route.kind === 'client-check-ins' || route.kind === 'check-ins') {
      const window = parseVisitWindow(url.searchParams);
      const result = await queryVisitRegister({
        ...window,
        branch: url.searchParams.get('branch') || '',
        clientId: route.clientId || url.searchParams.get('clientId') || '',
        phone: url.searchParams.get('phone') || '',
      });
      return json({ from: window.from, to: window.to, count: result.checkIns.length, ...result });
    }
    if (route.kind === 'check-in-checkout') {
      const body = await readJson(request);
      const checkIn = await checkOutClient({ visitId: route.visitId, staffName: body.staffName || 'SPA_SYS_API_V1' });
      return json({ checkIn });
    }
    if (route.kind === 'check-outs') {
      const body = await readJson(request);
      const checkIn = await checkOutClient({
        visitId: body.visitId || body.id || '',
        phone: body.phone || body.phoneNumber || '',
        clientId: body.clientId || '',
        staffName: body.staffName || 'SPA_SYS_API_V1',
      });
      return json({ checkIn });
    }
    return json(errorBody('NOT_FOUND', 'Endpoint not found.'), 404);
  } catch (error) {
    if (error instanceof ApiError || error instanceof ContractError) {
      const code = error.extra?.code || (error.status === 404 ? 'NOT_FOUND' : error.status === 409 ? 'CONFLICT' : 'VALIDATION_ERROR');
      return json(errorBody(code, error.message), error.status);
    }
    console.error('SPA_SYS_API_V1 error:', error?.message || 'Unknown error');
    return json(errorBody('INTERNAL', 'Internal server error.'), 500);
  }
}

export function methodNotAllowed(request) {
  const cleartext = rejectCleartext(request);
  if (cleartext) return cleartext;
  return json(errorBody('METHOD_NOT_ALLOWED', 'This method is not allowed for this endpoint.'), 405, { Allow: 'GET, PATCH, POST' });
}
