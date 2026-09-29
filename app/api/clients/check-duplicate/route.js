import { NextResponse } from 'next/server';
import { authorizeSpaGymClientRequest, getServerFirestore } from '@/lib/firebase-server';
import { extractAllPhoneNumbers } from '@/lib/phoneUtils';
import { query, where, getDocs, collection } from 'firebase/firestore';

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

    // Use indexed 'array-contains' queries instead of downloading the entire
    // clients collection. The phoneNumbers array field is populated on every
    // addClient/updateClient call.
    const db = getServerFirestore();
    for (const number of numbers) {
      const q = query(collection(db, 'clients'), where('phoneNumbers', 'array-contains', number));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return NextResponse.json({ exists: true });
      }
    }

    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error('Error in GET /api/clients/check-duplicate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
