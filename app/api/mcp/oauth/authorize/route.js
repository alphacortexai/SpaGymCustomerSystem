import { NextResponse } from 'next/server';
import { beginAuthorization } from '@/lib/adminMcpAuth';
import { authorizationRedirect, connectPagePath } from '@/lib/adminMcp';
import { empty, json, noStoreCors } from '@/lib/adminMcpHttp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return empty(204);
}

export async function GET(request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  try {
    const { decision } = await beginAuthorization(params);
    if (!decision.ok && !decision.redirect) {
      return json({ error: decision.error, error_description: decision.description }, 400);
    }
    if (!decision.ok) {
      return NextResponse.redirect(authorizationRedirect(decision.redirectUri, decision), { status: 302, headers: noStoreCors });
    }
    return NextResponse.redirect(new URL(connectPagePath(decision.request), request.url), { status: 302, headers: noStoreCors });
  } catch (error) {
    console.error('Admin MCP authorization failed:', error?.code || error?.name || 'unexpected');
    return json({ error: 'server_error', error_description: 'Authorization could not be started.' }, 500);
  }
}
