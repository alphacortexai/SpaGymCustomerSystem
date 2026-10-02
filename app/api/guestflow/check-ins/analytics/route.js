import { NextResponse } from 'next/server';
import { authorizeSpaIntakeRequest } from '@/lib/firebase-server';
import { ApiError, listCheckIns } from '@/lib/guestflowApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const TOP_ADMIN_EMAIL = 'alphacortexai@gmail.com';

function dateRange(start, end) {
  const dates = [];
  let cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cursor <= last && dates.length <= 366) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

export async function GET(request) {
  const access = await authorizeSpaIntakeRequest(request, 'clients');
  if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });
  if (String(access.profile?.email || '').toLowerCase() !== TOP_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Only the platform administrator can view check-in analytics.' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || '';
    const end = searchParams.get('end') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
      return NextResponse.json({ error: 'A valid start and end date are required.' }, { status: 400 });
    }
    const dates = dateRange(start, end);
    if (!dates.length || dates.length > 366) return NextResponse.json({ error: 'The selected period must be between 1 and 366 days.' }, { status: 400 });
    const visitsByDate = await Promise.all(dates.map((date) => listCheckIns(date, '', null)));
    return NextResponse.json({ visits: visitsByDate.flat() }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, ...error.extra }, { status: error.status });
    console.error('Check-in analytics error:', error);
    return NextResponse.json({ error: 'Could not fetch check-in analytics.' }, { status: 500 });
  }
}
