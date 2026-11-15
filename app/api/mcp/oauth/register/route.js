import { OAuthError, registerOAuthClient } from '@/lib/adminMcpAuth';
import { clientAddress, empty, json, readOAuthBody } from '@/lib/adminMcpHttp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return empty(204);
}

export async function POST(request) {
  try {
    const body = await readOAuthBody(request);
    const client = await registerOAuthClient(body, { ip: clientAddress(request) });
    return json(client, 201);
  } catch (error) {
    if (error instanceof OAuthError) return json({ error: error.oauthError, error_description: error.message }, error.status);
    console.error('Admin MCP client registration failed:', error?.code || error?.name || 'unexpected');
    return json({ error: 'server_error', error_description: 'The OAuth client could not be registered.' }, 500);
  }
}
