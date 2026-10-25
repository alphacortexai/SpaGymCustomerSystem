import { NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/lib/firebase-server';
import { createSpaSysIntegration, listSpaSysIntegrations } from '@/lib/spaSysIntegrations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'private, no-store' };

async function getAdmin(request) {
  const access = await authorizeAdminRequest(request);
  if (!access.ok) {
    return { response: NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status, headers: noStore }) };
  }
  return { access };
}

function actorName(profile) {
  return profile?.displayName || profile?.email || 'Admin';
}

export async function GET(request) {
  const { response } = await getAdmin(request);
  if (response) return response;
  try {
    const integrations = await listSpaSysIntegrations();
    return NextResponse.json({ integrations, basePath: '/api/spa-sys/v1' }, { headers: noStore });
  } catch (error) {
    console.error('Unable to list SPA SYS registrations:', error?.code || error?.message);
    return NextResponse.json({ error: 'Unable to load API registrations.' }, { status: 500, headers: noStore });
  }
}

export async function POST(request) {
  const { access, response } = await getAdmin(request);
  if (response) return response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Send a JSON body with the system name.' }, { status: 400, headers: noStore });
    }
    const result = await createSpaSysIntegration({
      name: body.name,
      webhookUrl: body.webhookUrl,
      scopes: body.scopes,
      expiresAt: body.expiresAt,
      createdBy: access.uid,
      createdByName: actorName(access.profile),
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
    return NextResponse.json(result, { status: 201, headers: noStore });
  } catch (error) {
    console.error('Unable to register a SPA SYS system:', error?.code || error?.message);
    return NextResponse.json({ error: 'Unable to register this system.' }, { status: 500, headers: noStore });
  }
}
