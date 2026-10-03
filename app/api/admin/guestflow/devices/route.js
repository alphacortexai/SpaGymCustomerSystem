import { NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/lib/firebase-server';
import { listGuestFlowDevices } from '@/lib/guestflowApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const access = await authorizeAdminRequest(request);
  if (!access.ok) return NextResponse.json({ error: 'Administrator access required.' }, { status: access.status });
  try {
    return NextResponse.json({ devices: await listGuestFlowDevices() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Could not load GuestFlow devices:', error);
    return NextResponse.json({ error: 'Could not load GuestFlow device requests.' }, { status: 500 });
  }
}
