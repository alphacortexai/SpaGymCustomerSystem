import { OAuthError, exchangeAuthorizationCode, exchangeRefreshToken } from '@/lib/adminMcpAuth';
import { empty, json, readOAuthBody } from '@/lib/adminMcpHttp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return empty(204);
}

export async function POST(request) {
  try {
    const body = await readOAuthBody(request);
    const grant = String(body.grant_type || '');
    const token = grant === 'authorization_code'
      ? await exchangeAuthorizationCode(body)
      : grant === 'refresh_token'
        ? await exchangeRefreshToken(body)
        : null;
    if (!token) return json({ error: 'unsupported_grant_type', error_description: 'Use authorization_code or refresh_token.' }, 400);
    return json(token);
  } catch (error) {
    if (error instanceof OAuthError) return json({ error: error.oauthError, error_description: error.message }, error.status);
    console.error('Admin MCP token exchange failed:', error?.code || error?.name || 'unexpected');
    return json({ error: 'server_error', error_description: 'The access token could not be issued.' }, 500);
  }
}
