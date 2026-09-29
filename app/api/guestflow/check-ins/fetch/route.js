import { NextResponse } from 'next/server';
import { authorizeSpaGymClientRequest } from '@/lib/firebase-server';
import { getGuestFlowVisitsForDate } from '@/lib/guestflowVisits';

export const runtime = 'nodejs';

// GET /api/guestflow/check-ins/fetch?date=2024-01-15
// Fetches GuestFlow check-ins for a specific date (YYYY-MM-DD format).
// Falls back to today if no date is provided.
export async function GET(request) {
  const access = await authorizeSpaGymClientRequest(request, 'view');
  if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const visits = date
      ? await getGuestFlowVisitsForDate(date, { canCheckOut: true })
      : await getGuestFlowVisitsForDate(new Date(), { canCheckOut: true });

    return NextResponse.json({ visits });
  } catch (error) {
    console.error('Fetch GuestFlow visits error:', error);
    return NextResponse.json({ error: 'Could not fetch check-in records.' }, { status: 500 });
  }
}
