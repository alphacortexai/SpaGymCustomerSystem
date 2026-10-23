import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/guestflowApi';
import { queryClientProfiles, getClientProfile, queryVisitRegister } from '@/lib/clientDataApi';
import {
  CLIENT_DATA_API_INDEX,
  ContractError,
  assessClientDataAccess,
  parseResultLimit,
  parseVisitWindow,
  readConfiguredSecrets,
  rejectsCleartext,
  resolveClientDataRoute,
  secretsAreConfigured,
} from '@/lib/clientDataContract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const secrets = readConfiguredSecrets(process.env.CLIENT_DATA_API_KEY);
  if (!loggedConfiguration && !secretsAreConfigured(secrets)) {
    loggedConfiguration = true;
    console.error('CLIENT_DATA_API_KEY is missing, contains spaces, or is shorter than 32 characters. The client data API will reject every request.');
  }
  return secrets;
}

function authorize(request) {
  const presented = presentedKey(request);
  if (presented.error) {
    const decision = assessClientDataAccess({
      presentedKey: '',
      secrets: configuredSecrets(),
      address: requestAddress(request),
    });
    if (decision.status === 429) {
      return json(errorBody('RATE_LIMITED', 'Too many requests. Try again later.'), 429, {
        'Retry-After': String(decision.retryAfterSeconds),
      });
    }
    return json(errorBody('UNAUTHORIZED', presented.error), 401);
  }
  const decision = assessClientDataAccess({
    presentedKey: presented.key,
    secrets: configuredSecrets(),
    address: requestAddress(request),
  });
  if (decision.status === 429) {
    return json(errorBody('RATE_LIMITED', 'Too many requests. Try again later.'), 429, {
      'Retry-After': String(decision.retryAfterSeconds),
    });
  }
  if (decision.status !== 200) return json(errorBody('UNAUTHORIZED', 'Unauthorized.'), 401);
  return null;
}

function rejectCleartext(request) {
  if (!rejectsCleartext({ forwardedProto: request.headers.get('x-forwarded-proto') || '', nodeEnv: process.env.NODE_ENV })) return null;
  return json(errorBody('HTTPS_REQUIRED', 'Client data requests must use HTTPS.'), 400);
}

async function handle(request, context) {
  const cleartext = rejectCleartext(request);
  if (cleartext) return cleartext;

  const rejected = authorize(request);
  if (rejected) return rejected;

  try {
    const { resource = [] } = await context.params;
    const route = resolveClientDataRoute(resource);
    const url = new URL(request.url);

    if (route.kind === 'index') return json(CLIENT_DATA_API_INDEX);
    if (route.kind === 'clients') {
      const clients = await queryClientProfiles({
        phone: url.searchParams.get('phone') || '',
        search: url.searchParams.get('search') || '',
        limit: parseResultLimit(url.searchParams.get('limit'), { fallback: 20, max: 50 }),
      });
      return json({ count: clients.length, clients });
    }
    if (route.kind === 'client') {
      const client = await getClientProfile(route.clientId);
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
    return json(errorBody('NOT_FOUND', 'Endpoint not found.'), 404);
  } catch (error) {
    if (error instanceof ApiError || error instanceof ContractError) {
      const code = error.extra?.code || (error.status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR');
      return json(errorBody(code, error.message), error.status);
    }
    console.error('Client data API error:', error?.message || 'Unknown error');
    return json(errorBody('INTERNAL', 'Internal server error.'), 500);
  }
}

function methodNotAllowed(request) {
  const cleartext = rejectCleartext(request);
  if (cleartext) return cleartext;
  return json(errorBody('METHOD_NOT_ALLOWED', 'This API is read-only. Use GET.'), 405, { Allow: 'GET' });
}

export const GET = handle;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
