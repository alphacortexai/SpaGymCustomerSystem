import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { addClient, getAllClients, searchClients, getTodaysBirthdays } from '@/lib/clients';
import { authorizeSpaGymClientRequest } from '@/lib/firebase-server';
async function checkAuth(request, action) {
  return authorizeSpaGymClientRequest(request, action);
}

export async function GET(request) {
  try {
    const access = await checkAuth(request, 'view');
    if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const birthdays = searchParams.get('birthdays');

    if (birthdays === 'today') {
      const results = await getTodaysBirthdays();
      return NextResponse.json({ clients: results });
    }

    if (search) {
      const results = await searchClients(search);
      return NextResponse.json({ clients: results });
    }

    const clients = await getAllClients();
    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Error in GET /api/clients:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const access = await checkAuth(request, 'add');
    if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });

    const body = await request.json();
    const result = await addClient(body);

    if (result.success) {
      return NextResponse.json({ success: true, id: result.id });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to add client' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/clients:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
