import { NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/lib/firebase-server';
import { deleteSpaSysIntegration, rotateSpaSysCredential, updateSpaSysIntegration } from '@/lib/spaSysIntegrations';

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

async function integrationIdFrom(context) {
  const params = await context.params;
  return params?.integrationId || '';
}

export async function PATCH(request, context) {
  const { response } = await getAdmin(request);
  if (response) return response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Send the fields to change.' }, { status: 400, headers: noStore });
    }
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(body, 'name')) patch.name = body.name;
    if (Object.prototype.hasOwnProperty.call(body, 'webhookUrl')) patch.webhookUrl = body.webhookUrl;
    if (Object.prototype.hasOwnProperty.call(body, 'status')) patch.status = body.status;
    const result = await updateSpaSysIntegration(await integrationIdFrom(context), patch);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    console.error('Unable to update a SPA SYS registration:', error?.code || error?.message);
    return NextResponse.json({ error: 'Unable to update this registration.' }, { status: 500, headers: noStore });
  }
}

export async function POST(request, context) {
  const { response } = await getAdmin(request);
  if (response) return response;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await rotateSpaSysCredential(await integrationIdFrom(context), body?.credential);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    console.error('Unable to rotate a SPA SYS credential:', error?.code || error?.message);
    return NextResponse.json({ error: 'Unable to replace this credential.' }, { status: 500, headers: noStore });
  }
}

export async function DELETE(request, context) {
  const { response } = await getAdmin(request);
  if (response) return response;
  try {
    const result = await deleteSpaSysIntegration(await integrationIdFrom(context));
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    console.error('Unable to delete a SPA SYS registration:', error?.code || error?.message);
    return NextResponse.json({ error: 'Unable to delete this registration.' }, { status: 500, headers: noStore });
  }
}
