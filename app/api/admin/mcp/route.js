import { authorizeAdminRequest } from '@/lib/firebase-server';
import { ADMIN_MCP_TOOLS, TOP_ADMIN_EMAIL } from '@/lib/adminMcp';
import { credentialStatus, mintCredential } from '@/lib/adminMcpAuth';
import { requestOrigin } from '@/lib/adminMcpHttp';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'private, no-store' };

function denied(access) {
  const status = access.ok ? 403 : (access.status === 403 ? 403 : 401);
  const error = status === 403 ? 'Only the top administrator can manage the Grok MCP.' : 'Unauthorized';
  return NextResponse.json({ error }, { status, headers: noStore });
}

function topAdmin(access) {
  return access.ok && String(access.email || '').toLowerCase() === TOP_ADMIN_EMAIL;
}

export async function GET(request) {
  const access = await authorizeAdminRequest(request);
  if (!topAdmin(access)) return denied(access);
  try {
    const status = await credentialStatus();
    return NextResponse.json({
      endpoint: `${requestOrigin(request)}/api/mcp`,
      tools: ADMIN_MCP_TOOLS.map((tool) => tool.name),
      ...status,
    }, { headers: noStore });
  } catch (error) {
    console.error('Admin MCP status failed:', error?.code || error?.name || 'unexpected');
    return NextResponse.json({ error: 'Unable to load the Grok connection.' }, { status: 500, headers: noStore });
  }
}

export async function POST(request) {
  const access = await authorizeAdminRequest(request);
  if (!topAdmin(access)) return denied(access);
  try {
    const minted = await mintCredential({ uid: access.uid, email: access.email });
    return NextResponse.json({
      endpoint: `${requestOrigin(request)}/api/mcp`,
      ...minted,
    }, { headers: noStore });
  } catch (error) {
    console.error('Admin MCP key creation failed:', error?.code || error?.name || 'unexpected');
    return NextResponse.json({ error: 'Unable to create a connection key.' }, { status: 500, headers: noStore });
  }
}
