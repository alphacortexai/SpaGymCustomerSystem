import { NextResponse } from 'next/server';
import { authorizeSpaGymClientRequest } from '@/lib/firebase-server';
import { ApiError, recordCheckIn } from '@/lib/guestflowApi';

export const runtime = 'nodejs';

export async function POST(request) {
  const access = await authorizeSpaGymClientRequest(request, 'view');
  if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });

  try {
    const body = await request.json();
    if (!body?.clientId) return NextResponse.json({ error: 'Client selection is required.' }, { status: 400 });
    const result = await recordCheckIn('', String(body.clientId));
    return NextResponse.json(result, { status: result.alreadyCheckedIn ? 200 : 201 });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, ...error.extra }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    console.error('Manual GuestFlow check-in error:', error);
    return NextResponse.json({ error: 'The check-in could not be recorded.' }, { status: 500 });
  }
}
