import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { authorizeAdminRequest, getServerFirestore } from '@/lib/firebase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const collection = () => getServerFirestore().collection('feedbackAttentionReviews');
const clean = (value) => typeof value === 'string' ? value.trim() : '';

function serialize(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serialize(entry)]));
  return value;
}

export async function GET(request) {
  const access = await authorizeAdminRequest(request);
  if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });
  try {
    const snapshot = await collection().orderBy('updatedAt', 'desc').limit(50).get();
    return NextResponse.json({ reviews: snapshot.docs.map((entry) => ({ id: entry.id, ...serialize(entry.data()) })) });
  } catch (error) {
    console.error('Unable to list saved feedback reviews:', error?.message);
    return NextResponse.json({ error: 'Unable to load saved feedback reviews.' }, { status: 500 });
  }
}

export async function POST(request) {
  const access = await authorizeAdminRequest(request);
  if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });
  try {
    const body = await request.json();
    const result = body?.result;
    if (!result || !clean(result.startDate) || !clean(result.endDate)) {
      return NextResponse.json({ error: 'A completed feedback review is required.' }, { status: 400 });
    }
    const now = FieldValue.serverTimestamp();
    const docRef = collection().doc();
    const payload = {
      title: clean(body.title) || `Feedback review - ${result.startDate} to ${result.endDate}`,
      startDate: clean(result.startDate),
      endDate: clean(result.endDate),
      branch: clean(result.branch),
      guidance: clean(result.guidance).slice(0, 3000),
      provider: clean(result.provider),
      reportCount: Number(result.reportCount) || 0,
      feedbackCount: Number(result.feedbackCount) || 0,
      summary: clean(result.summary),
      summaryFallback: Boolean(result.summaryFallback),
      findings: Array.isArray(result.findings) ? result.findings.slice(0, 300) : [],
      createdBy: access.uid,
      createdByName: access.profile?.displayName || access.profile?.email || access.uid,
      createdAt: now,
      updatedAt: now,
    };
    await docRef.set(payload);
    return NextResponse.json({ review: { id: docRef.id, ...serialize({ ...payload, createdAt: new Date(), updatedAt: new Date() }) } });
  } catch (error) {
    console.error('Unable to save feedback review:', error?.message);
    return NextResponse.json({ error: 'Unable to save the feedback review.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const access = await authorizeAdminRequest(request);
  if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });
  try {
    const id = clean(new URL(request.url).searchParams.get('id'));
    if (!id || id.includes('/')) return NextResponse.json({ error: 'A saved review id is required.' }, { status: 400 });
    await collection().doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unable to delete saved feedback review:', error?.message);
    return NextResponse.json({ error: 'Unable to delete the saved feedback review.' }, { status: 500 });
  }
}
