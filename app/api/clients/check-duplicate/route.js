import { NextResponse } from 'next/server';
import { authorizeSpaGymClientRequest, getServerFirestore } from '@/lib/firebase-server';
import { extractAllPhoneNumbers } from '@/lib/phoneUtils';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const access = await authorizeSpaGymClientRequest(request, 'add');
    if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });

    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber');

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const numbers = extractAllPhoneNumbers(phoneNumber);
    if (!numbers.length) return NextResponse.json({ error: 'Phone number is invalid.' }, { status: 400 });
    const snapshot = await getServerFirestore().collection('clients').get();
    const exists = snapshot.docs.some((item) => extractAllPhoneNumbers(item.data().phoneNumber || '').some((number) => numbers.includes(number)));
    return NextResponse.json({ exists });
  } catch (error) {
    console.error('Error in GET /api/clients/check-duplicate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
