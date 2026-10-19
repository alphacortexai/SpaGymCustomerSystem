import { NextResponse } from 'next/server';
import { addClient, getAllClients, getTodaysBirthdays } from '@/lib/clients';
import {
  buildIndexedSearchQueries,
  buildRecentFallbackQuery,
  rankSearchResults,
  shouldUseRecentFallback,
} from '@/lib/clientSearch';
import { authorizeSpaGymClientRequest, getServerFirestore } from '@/lib/firebase-server';

function serializeClient(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    dateOfBirth: data.dateOfBirth?.toDate?.()?.toISOString?.() || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
  };
}

async function checkAuth(request, action) {
  return authorizeSpaGymClientRequest(request, action);
}

function applySearchQuery(collectionRef, spec) {
  let clientQuery = collectionRef;
  if (spec.branch) clientQuery = clientQuery.where('branch', '==', spec.branch);
  if (spec.op === 'prefix') {
    clientQuery = clientQuery.where(spec.field, '>=', spec.value).where(spec.field, '<=', `${spec.value}\uf8ff`);
  } else if (spec.op === 'recent') {
    clientQuery = clientQuery.orderBy('createdAt', 'desc');
  } else {
    clientQuery = clientQuery.where(spec.field, spec.op, spec.value);
  }
  return clientQuery.limit(spec.limit);
}

async function readSearchQuery(db, spec) {
  try {
    return await applySearchQuery(db.collection('clients'), spec).get();
  } catch (error) {
    if (!spec.branch) {
      console.warn('Indexed client search query failed:', error?.message || error);
      return null;
    }
    try {
      return await applySearchQuery(db.collection('clients'), { ...spec, branch: null }).get();
    } catch (fallbackError) {
      console.warn('Indexed client search query failed:', fallbackError?.message || fallbackError);
      return null;
    }
  }
}

async function searchClientsByIndex(search, branch) {
  const db = getServerFirestore();
  const matches = new Map();
  const collect = (snapshot) => {
    if (!snapshot) return;
    snapshot.docs.forEach((clientSnapshot) => {
      if (!matches.has(clientSnapshot.id)) matches.set(clientSnapshot.id, serializeClient(clientSnapshot));
    });
  };

  const indexedSnapshots = await Promise.all(
    buildIndexedSearchQueries(search, branch).map((spec) => readSearchQuery(db, spec))
  );
  indexedSnapshots.forEach(collect);

  if (shouldUseRecentFallback([...matches.values()], search, branch)) {
    collect(await readSearchQuery(db, buildRecentFallbackQuery(branch)));
  }

  return rankSearchResults([...matches.values()], search, branch);
}

export async function GET(request) {
  try {
    const access = await checkAuth(request, 'view');
    if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const branch = searchParams.get('branch')?.trim() || null;
    const birthdays = searchParams.get('birthdays');

    if (birthdays === 'today') {
      const results = await getTodaysBirthdays();
      return NextResponse.json({ clients: results });
    }

    if (search) {
      const matches = await searchClientsByIndex(search, branch);
      return NextResponse.json({ clients: matches });
    }

    const clients = await getAllClients();
    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Error in GET /api/clients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const access = await checkAuth(request, 'add');
    if (!access.ok) return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status });
    const body = await request.json();
    const result = await addClient(body);
    if (result.success) return NextResponse.json({ success: true, id: result.id });
    return NextResponse.json({ error: result.error || 'Failed to add client' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/clients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
