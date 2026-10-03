import { NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/lib/firebase-server';
import { updateGuestFlowDevice } from '@/lib/guestflowApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, context) {
  const access = await authorizeAdminRequest(request);
  if (!access.ok) return NextResponse.json({ error: 'Administrator access required.' }, { status: access.status });
  try {
    const { deviceId, action } = await context.params;
    const input = action === 'rename' ? await request.json().catch(() => ({})) : {};
    const device = await updateGuestFlowDevice(
      decodeURIComponent(deviceId),
      action,
      access.profile?.email || access.uid,
      input.name,
    );
    return NextResponse.json({ device }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error?.status || 500;
    if (status < 500) return NextResponse.json({ error: error.message }, { status });
    console.error('Could not update GuestFlow device:', error);
    return NextResponse.json({ error: 'Could not update the GuestFlow device.' }, { status: 500 });
  }
}
