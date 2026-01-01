import { NextResponse } from 'next/server';
import { checkDuplicatePhone } from '@/lib/clients';

// Simple auth check
function checkAuth(request) {
  const authHeader = request.headers.get('authorization');
  return !!authHeader || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
}

export async function GET(request) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber');

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const exists = await checkDuplicatePhone(phoneNumber);
    return NextResponse.json({ exists });
  } catch (error) {
    console.error('Error in GET /api/clients/check-duplicate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

