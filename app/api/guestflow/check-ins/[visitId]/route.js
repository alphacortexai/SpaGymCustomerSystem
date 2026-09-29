import { NextResponse } from 'next/server';
import { authorizeSpaGymClientRequest, getServerFirestore } from '@/lib/firebase-server';

export const runtime = 'nodejs';

export async function DELETE(request, context) {
  const access = await authorizeSpaGymClientRequest(request, 'view');
  if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });
  if (String(access.profile?.email || '').toLowerCase() !== 'alphacortexai@gmail.com') {
    return NextResponse.json({ error: 'Only the platform administrator can delete check-ins.' }, { status: 403 });
  }

  const { visitId } = await context.params;
  if (!visitId || visitId.length > 180 || visitId.includes('/')) {
    return NextResponse.json({ error: 'Invalid check-in id.' }, { status: 400 });
  }

  try {
    const visitRef = getServerFirestore().collection('guestflowVisits').doc(visitId);
    const snapshot = await visitRef.get();
    if (!snapshot.exists) return NextResponse.json({ error: 'Check-in record was not found.' }, { status: 404 });
    await visitRef.delete();
    return NextResponse.json({ success: true, id: visitId });
  } catch (error) {
    console.error('Delete GuestFlow check-in error:', error);
    return NextResponse.json({ error: 'The check-in could not be deleted.' }, { status: 500 });
  }
}
