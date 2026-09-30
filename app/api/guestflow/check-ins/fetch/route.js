import { NextResponse } from 'next/server';
import { authorizeSpaIntakeRequest } from '@/lib/firebase-server';
import { ApiError, listCheckIns } from '@/lib/guestflowApi';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// GET /api/guestflow/check-ins/fetch?date=2024-01-15
// Fetches GuestFlow check-ins for a specific date (YYYY-MM-DD format).
// Falls back to today if no date is provided.
export async function GET(request) {
  const access = await authorizeSpaIntakeRequest(request, 'clients');
  if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const allowedBranches = access.isPlatformAdmin ? null : access.spaIntakeBranches;
    const visits = await listCheckIns(date || undefined, '', allowedBranches);

    return NextResponse.json({ visits }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, ...error.extra }, { status: error.status });
    }
    console.error('Fetch GuestFlow visits error:', error);
    return NextResponse.json({ error: 'Could not fetch check-in records.' }, { status: 500 });
  }
}
