import { NextResponse } from 'next/server';
import { authorizeSpaIntakeRequest, getServerFirestore } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

function json(data, init = {}) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      ...init.headers,
    },
  });
}

function serializeFirestoreValue(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeFirestoreValue(nestedValue)])
    );
  }
  return value;
}

export async function GET(request) {
  try {
    const access = await authorizeSpaIntakeRequest(request);
    if (!access.ok) {
      return json(
        { error: access.status === 403 ? 'Forbidden' : 'Unauthorized' },
        { status: access.status }
      );
    }

    const requestedBranch = new URL(request.url).searchParams.get('branch') || '';
    let query = getServerFirestore().collection('spa_enrollments');

    if (requestedBranch) {
      if (!access.isPlatformAdmin && !access.spaIntakeBranches.includes(requestedBranch)) {
        return json({ error: 'You do not have access to this branch.' }, { status: 403 });
      }
      query = query.where('branch', '==', requestedBranch);
    } else if (!access.isPlatformAdmin) {
      const allowedBranches = [...new Set(access.spaIntakeBranches.map((branch) => String(branch).trim()).filter(Boolean))];
      if (allowedBranches.length === 0) return json({ enrollments: [] });
      query = query.where('branch', 'in', allowedBranches);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();
    const enrollments = snapshot.docs.map((document) => ({
      id: document.id,
      ...serializeFirestoreValue(document.data()),
    }));
    return json({ enrollments });
  } catch (error) {
    console.error('Error loading spa intake enrollments:', error);
    return json({ error: 'Unable to load spa intake enrollments.' }, { status: 500 });
  }
}
