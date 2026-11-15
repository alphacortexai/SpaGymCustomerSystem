import { NextResponse } from 'next/server';
import {
  authorizationServerMetadata,
  originFromHeaders,
  protectedResourceMetadata,
  unauthorizedChallenge,
} from './adminMcp.js';

export const noStoreCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
  'Cache-Control': 'no-store',
};

export function requestOrigin(request) {
  return originFromHeaders({
    url: request.url,
    forwardedProto: request.headers.get('x-forwarded-proto'),
    forwardedHost: request.headers.get('x-forwarded-host'),
    host: request.headers.get('host'),
  });
}

export function json(body, status = 200, headers = {}) {
  return NextResponse.json(body, { status, headers: { ...noStoreCors, ...headers } });
}

export function empty(status, headers = {}) {
  return new NextResponse(null, { status, headers: { ...noStoreCors, ...headers } });
}

export function unauthorized(origin) {
  return json(
    { error: 'unauthorized', message: 'This MCP is available to the top administrator only.' },
    401,
    { 'WWW-Authenticate': unauthorizedChallenge(origin) },
  );
}

export function resourceMetadata(request) {
  return json(protectedResourceMetadata(requestOrigin(request)), 200, { 'Cache-Control': 'public, max-age=300' });
}

export function serverMetadata(request) {
  return json(authorizationServerMetadata(requestOrigin(request)), 200, { 'Cache-Control': 'public, max-age=300' });
}

export function wantsEventStream(request) {
  return (request.headers.get('accept') || '').includes('text/event-stream');
}

export function mcpResult(request, payload) {
  if (payload.notification) return empty(202);
  if (wantsEventStream(request) && payload.status === 200) {
    return new NextResponse(`event: message\ndata: ${JSON.stringify(payload.body)}\n\n`, {
      status: 200,
      headers: { ...noStoreCors, 'Content-Type': 'text/event-stream' },
    });
  }
  return json(payload.body, payload.status || 200);
}

export async function readOAuthBody(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return request.json();
  const text = await request.text();
  return Object.fromEntries(new URLSearchParams(text));
}

export function clientAddress(request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  return forwarded.split(',')[0].trim() || 'unknown';
}
