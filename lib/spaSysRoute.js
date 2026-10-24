import { NextResponse } from 'next/server';
import { ApiError, listBranches } from '@/lib/guestflowApi';
import { checkOutClient, getClientProfile, queryClientProfiles, queryVisitRegister, updateClientProfile } from '@/lib/clientDataApi';
import { findActiveIntegrationByKey } from '@/lib/spaSysIntegrations';
import { describeSpaSysRequest } from '@/lib/spaSysActivity';
import { classifySpaSysOperation, noteSpaSysRequest, noteSpaSysRequestLog } from '@/lib/spaSysActivityStore';
import {
  ContractError,
  SPA_SYS_API_INDEX,
  assessClientDataAccess,
  authorizePresentedKey,
  clientUpdateChanges,
  grantSpaSysAccess,
  parseResultLimit,
  parseVisitWindow,
  readConfiguredSecrets,
  rejectsCleartext,
  resolveClientDataRoute,
  secretsAreConfigured,
} from '@/lib/clientDataContract';

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
  return readConfiguredSecrets([process.env.SPA_SYS_API_KEY, process.env.CLIENT_DATA_API_KEY].filter(Boolean).join(','));
}

function accessResponse(decision, unauthorizedMessage) {
  if (decision.status === 429) {
    return json(errorBody('RATE_LIMITED', 'Too many requests. Try again later.'), 429, {
      'Retry-After': String(decision.retryAfterSeconds),
    });
  }
  if (decision.status !== 200) return json(errorBody('UNAUTHORIZED', unauthorizedMessage), 401);
  return null;
}

function recognizedIdentity(decision, identity) {
  if (!identity || (decision.status !== 200 && decision.status !== 429)) return null;
  return identity;
}

async function authorize(request) {
  const presented = presentedKey(request);
  const address = requestAddress(request);
  const secrets = configuredSecrets();
  if (presented.error) {
    const decision = assessClientDataAccess({ presentedKey: '', secrets, address });
    return { response: accessResponse(decision, presented.error), identity: null };
  }
  if (secretsAreConfigured(secrets) && authorizePresentedKey(presented.key, secrets).ok) {
    const decision = assessClientDataAccess({ presentedKey: presented.key, secrets, address });
    const identity = recognizedIdentity(decision, {
      source: 'environment',
      subjectId: `env_${decision.keyId}`,
      name: 'Environment key',
      keyPreview: presented.key.slice(0, 8),
    });
    return { response: accessResponse(decision, 'Unauthorized.'), identity };
  }
  try {
    const registered = await findActiveIntegrationByKey(presented.key);
    if (registered) {
      const decision = grantSpaSysAccess({ presentedKey: presented.key, address });
      const identity = recognizedIdentity(decision, {
        source: 'registered',
        subjectId: registered.id,
        name: registered.name || 'Registered system',
        keyPreview: registered.keyPreview || presented.key.slice(0, 8),
      });
      return { response: accessResponse(decision, 'Unauthorized.'), identity };
    }
  } catch (error) {
    console.error('SPA_SYS_API_V1 could not check a registered key:', error?.message || 'Unknown error');
  }
  const decision = assessClientDataAccess({ presentedKey: presented.key, secrets, address });
  return { response: accessResponse(decision, 'Unauthorized.'), identity: null };
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

async function finish(response, request, identity, kind) {
  const caller = identity || { source: 'unrecognized', subjectId: 'unrecognized', name: 'Unrecognized' };
  let detail = describeSpaSysRequest({ method: request.method, kind });
  try {
    const url = new URL(request.url);
    detail = describeSpaSysRequest({
      method: request.method,
      kind,
      hasPhone: url.searchParams.has('phone'),
      hasSearch: url.searchParams.has('search'),
    });
  } catch {
    detail = describeSpaSysRequest({ method: request.method, kind });
  }
  let errorCode = '';
  let errorMessage = '';
  if (response.status >= 400) {
    try {
      const body = await response.clone().json();
      errorCode = String(body?.error?.code || '');
      errorMessage = String(body?.error?.message || '');
    } catch {
      errorCode = '';
    }
  }
  noteSpaSysRequest({
    identity: caller,
    status: response.status,
    operation: classifySpaSysOperation(request.method, kind),
  });
  noteSpaSysRequestLog({
    identity: caller,
    channel: 'api',
    request: detail.request,
    path: detail.path,
    status: response.status,
    success: response.status < 400,
    errorCode,
    errorMessage,
  });
  return response;
}

export async function dispatch(request, context) {
  const cleartext = rejectCleartext(request);
  if (cleartext) return cleartext;
  const access = await authorize(request);
  let kind = 'not-found';
  if (access.response) {
    try {
      const { resource = [] } = await context.params;
      kind = resolveClientDataRoute(resource).kind;
    } catch {
      kind = 'not-found';
    }
    return finish(access.response, request, access.identity, kind);
  }

  try {
    const { resource = [] } = await context.params;
    const route = resolveClientDataRoute(resource);
    kind = route.kind;
    const method = request.method;
    const allowed = allowedMethods(route.kind);
    if (route.kind !== 'not-found' && !allowed.split(', ').includes(method)) {
      return finish(json(errorBody('METHOD_NOT_ALLOWED', 'This method is not allowed for this endpoint.'), 405, { Allow: allowed }), request, access.identity, route.kind);
    }
    const url = new URL(request.url);

    if (route.kind === 'index' && method === 'GET') return finish(json(SPA_SYS_API_INDEX), request, access.identity, route.kind);
    if (route.kind === 'branches' && method === 'GET') return finish(json({ branches: await listBranches() }), request, access.identity, route.kind);
    if (route.kind === 'clients' && method === 'GET') {
      const clients = await queryClientProfiles({
        phone: url.searchParams.get('phone') || '',
        search: url.searchParams.get('search') || '',
        limit: parseResultLimit(url.searchParams.get('limit'), { fallback: 20, max: 50 }),
      });
      return finish(json({ count: clients.length, clients }), request, access.identity, route.kind);
    }
    if (route.kind === 'clients' && method === 'PATCH') {
      const phone = url.searchParams.get('phone') || '';
      if (!phone) return finish(json(errorBody('VALIDATION_ERROR', 'Updating by phone requires the phone query parameter.'), 400), request, access.identity, route.kind);
      const matches = await queryClientProfiles({ phone, limit: 10 });
      if (!matches.length) return finish(json(errorBody('CLIENT_NOT_FOUND', 'No client record matches that phone number.'), 404), request, access.identity, route.kind);
      if (matches.length > 1) return finish(json(errorBody('AMBIGUOUS_CLIENT', 'More than one client has that phone number. Update by client id.'), 409), request, access.identity, route.kind);
      const client = await updateClientProfile(matches[0].id, clientUpdateChanges(await readJson(request)));
      if (!client) return finish(json(errorBody('CLIENT_NOT_FOUND', 'No client record matches that phone number.'), 404), request, access.identity, route.kind);
      return finish(json({ client }), request, access.identity, route.kind);
    }
    if (route.kind === 'client' && method === 'GET') {
      const client = await getClientProfile(route.clientId);
      if (!client) return finish(json(errorBody('CLIENT_NOT_FOUND', 'No client record matches that id.'), 404), request, access.identity, route.kind);
      return finish(json({ client }), request, access.identity, route.kind);
    }
    if (route.kind === 'client' && method === 'PATCH') {
      const client = await updateClientProfile(route.clientId, clientUpdateChanges(await readJson(request)));
      if (!client) return finish(json(errorBody('CLIENT_NOT_FOUND', 'No client record matches that id.'), 404), request, access.identity, route.kind);
      return finish(json({ client }), request, access.identity, route.kind);
    }
    if (route.kind === 'client-check-ins' || route.kind === 'check-ins') {
      const window = parseVisitWindow(url.searchParams);
      const result = await queryVisitRegister({
        ...window,
        branch: url.searchParams.get('branch') || '',
        clientId: route.clientId || url.searchParams.get('clientId') || '',
        phone: url.searchParams.get('phone') || '',
      });
      return finish(json({ from: window.from, to: window.to, count: result.checkIns.length, ...result }), request, access.identity, route.kind);
    }
    if (route.kind === 'check-in-checkout') {
      const body = await readJson(request);
      const checkIn = await checkOutClient({ visitId: route.visitId, staffName: body.staffName || 'SPA_SYS_API_V1' });
      return finish(json({ checkIn }), request, access.identity, route.kind);
    }
    if (route.kind === 'check-outs') {
      const body = await readJson(request);
      const checkIn = await checkOutClient({
        visitId: body.visitId || body.id || '',
        phone: body.phone || body.phoneNumber || '',
        clientId: body.clientId || '',
        staffName: body.staffName || 'SPA_SYS_API_V1',
      });
      return finish(json({ checkIn }), request, access.identity, route.kind);
    }
    return finish(json(errorBody('NOT_FOUND', 'Endpoint not found.'), 404), request, access.identity, route.kind);
  } catch (error) {
    if (error instanceof ApiError || error instanceof ContractError) {
      const code = error.extra?.code || (error.status === 404 ? 'NOT_FOUND' : error.status === 409 ? 'CONFLICT' : 'VALIDATION_ERROR');
      return finish(json(errorBody(code, error.message), error.status), request, access.identity, kind);
    }
    console.error('SPA_SYS_API_V1 error:', error?.message || 'Unknown error');
    return finish(json(errorBody('INTERNAL', 'Internal server error.'), 500), request, access.identity, kind);
  }
}

export function methodNotAllowed(request) {
  const cleartext = rejectCleartext(request);
  if (cleartext) return cleartext;
  return json(errorBody('METHOD_NOT_ALLOWED', 'This method is not allowed for this endpoint.'), 405, { Allow: 'GET, PATCH, POST' });
}
