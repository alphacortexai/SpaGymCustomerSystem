import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { addClient, getAllClients, searchClients, getTodaysBirthdays } from '@/lib/clients';

// Simple auth check - in production, verify Firebase ID token from header
function checkAuth(request) {
  // For now, we'll allow requests if Firebase is configured
  // In production, verify the Authorization header with Firebase Admin SDK
  const authHeader = request.headers.get('authorization');
  return !!authHeader || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
}

export async function GET(request) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

