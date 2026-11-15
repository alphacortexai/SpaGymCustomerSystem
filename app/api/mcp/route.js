import { createAdminMcpData } from '@/lib/adminMcpData';
import { verifyAdminMcpAccess } from '@/lib/adminMcpAuth';
import { handleMcpMessage, readBearer } from '@/lib/adminMcp';
import { takeRateLimitToken } from '@/lib/clientDataContract';
import { clientAddress, empty, json, mcpResult, requestOrigin, unauthorized } from '@/lib/adminMcpHttp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const attemptBuckets = new Map();

function limited(quota) {
  return json(
    { error: 'rate_limited', message: 'Too many MCP requests. Try again shortly.' },
    429,
    { 'Retry-After': String(quota.retryAfterSeconds) },
  );
}

async function requireAccess(request) {
  const token = readBearer(request.headers.get('authorization'));
  if (!token) return { response: unauthorized(requestOrigin(request)) };
  const quota = takeRateLimitToken(attemptBuckets, clientAddress(request), Date.now(), 180, 60 * 1000);
  if (!quota.allowed) return { response: limited(quota) };
  try {
    const access = await verifyAdminMcpAccess(token);
    if (!access.ok) return { response: unauthorized(requestOrigin(request)) };
    return { access };
  } catch (error) {
    console.error('Admin MCP authentication failed:', error?.code || error?.name || 'unexpected');
    return { response: json({ error: 'The admin MCP could not check access.' }, 500) };
  }
}

export function OPTIONS() {
  return empty(204);
}

export async function GET(request) {
  const access = await requireAccess(request);
  if (access.response) return access.response;
  return json({ error: 'This MCP server accepts tool calls with POST. It does not open an event stream.' }, 405, { Allow: 'POST, OPTIONS' });
}

export async function DELETE(request) {
  const access = await requireAccess(request);
  if (access.response) return access.response;
  return json({ error: 'This MCP server does not keep a session to close.' }, 405, { Allow: 'POST, OPTIONS' });
}

export async function POST(request) {
  const access = await requireAccess(request);
  if (access.response) return access.response;
  let message;
  try {
    message = await request.json();
  } catch {
    return mcpResult(request, { status: 400, body: { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } } });
  }
  const result = await handleMcpMessage(message, createAdminMcpData(), new Date());
  return mcpResult(request, result);
}
