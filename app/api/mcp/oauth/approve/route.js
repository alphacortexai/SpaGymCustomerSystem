import { authorizeAdminRequest } from '@/lib/firebase-server';
import { OAuthError, approveAuthorization } from '@/lib/adminMcpAuth';
import { TOP_ADMIN_EMAIL } from '@/lib/adminMcp';
import { empty, json } from '@/lib/adminMcpHttp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return empty(204);
}

export async function POST(request) {
  const access = await authorizeAdminRequest(request);
  if (!access.ok || String(access.email || '').toLowerCase() !== TOP_ADMIN_EMAIL) {
    return json({ error: 'access_denied', error_description: 'Only the top administrator can connect Grok.' }, access.ok ? 403 : access.status);
  }
  try {
    const body = await request.json();
    const approved = await approveAuthorization({ uid: access.uid, email: access.email }, body);
    return json(approved);
  } catch (error) {
    if (error instanceof OAuthError) return json({ error: error.oauthError, error_description: error.message }, error.status);
    console.error('Admin MCP approval failed:', error?.code || error?.name || 'unexpected');
    return json({ error: 'server_error', error_description: 'The connection could not be approved.' }, 500);
  }
}
