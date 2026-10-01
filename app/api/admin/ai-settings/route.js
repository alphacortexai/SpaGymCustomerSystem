import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { authorizeAdminRequest, getServerFirestore } from '@/lib/firebase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const settingsRef = () => getServerFirestore().collection('systemSettings').doc('aiFeedbackReview');

async function getAdmin(request) {
  const access = await authorizeAdminRequest(request);
  if (!access.ok) {
    return { response: NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status }) };
  }
  return { access };
}

export async function GET(request) {
  const { response } = await getAdmin(request);
  if (response) return response;
  try {
    const snapshot = await settingsRef().get();
    const settings = snapshot.data() || {};
    const updatedAt = settings.updatedAt?.toDate?.()?.toISOString?.() || '';
    return NextResponse.json({ configured: Boolean(settings.apiKey), updatedAt });
  } catch (error) {
    console.error('Unable to read AI settings status:', error?.code || error?.message);
    return NextResponse.json({ error: 'Unable to read AI settings.' }, { status: 500 });
  }
}

export async function PUT(request) {
  const { access, response } = await getAdmin(request);
  if (response) return response;
  try {
    const body = await request.json();
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    if (apiKey.length < 20 || apiKey.length > 500) {
      return NextResponse.json({ error: 'Enter a valid OpenAI API key.' }, { status: 400 });
    }
    const now = new Date();
    await settingsRef().set({ apiKey, updatedAt: now, updatedBy: access.uid }, { merge: true });
    return NextResponse.json({ success: true, configured: true, updatedAt: now.toISOString() });
  } catch (error) {
    console.error('Unable to save AI settings:', error?.code || error?.message);
    return NextResponse.json({ error: 'Unable to save AI settings.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { response } = await getAdmin(request);
  if (response) return response;
  try {
    await settingsRef().update({ apiKey: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ success: true, configured: false });
  } catch (error) {
    if (error?.code === 5) return NextResponse.json({ success: true, configured: false });
    console.error('Unable to remove AI settings:', error?.code || error?.message);
    return NextResponse.json({ error: 'Unable to remove the saved AI key.' }, { status: 500 });
  }
}
