import { NextResponse } from 'next/server';
import { addClient, getAllClients, getTodaysBirthdays } from '@/lib/clients';
import { authorizeSpaGymClientRequest, getServerFirestore } from '@/lib/firebase-server';

function normalizeText(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function digits(value = '') {
  return String(value).replace(/\D/g, '');
}

function phoneVariants(value = '') {
  const raw = digits(value);
  const variants = new Set(raw ? [raw] : []);
  if (/^256[789]\d{8}$/.test(raw)) variants.add(`0${raw.slice(3)}`);
  if (/^0[789]\d{8}$/.test(raw)) variants.add(`256${raw.slice(1)}`);
  return [...variants];
}

function scoreClient(client, search, branch) {
  if (branch && String(client.branch || '').trim().toLowerCase() !== branch.trim().toLowerCase()) return -1;
  const queryText = normalizeText(search);
  const queryTokens = queryText.split(' ').filter(Boolean);
  const nameText = normalizeText(client.name);
  const branchText = normalizeText(client.branch);
  const phoneText = digits(client.phoneNumber);
  const queryDigits = phoneVariants(search);
  const nameMatches = queryTokens.length > 0 && queryTokens.every((token) => nameText.includes(token));
  const branchMatches = queryTokens.length > 0 && queryTokens.every((token) => branchText.includes(token));
  const phoneMatches = queryDigits.some((queryPhone) => queryPhone.length >= 3 && phoneText.includes(queryPhone));
  if (!nameMatches && !branchMatches && !phoneMatches) return -1;

  if (nameText === queryText) return 0;
  if (nameText.startsWith(queryText)) return 1;
  if (phoneMatches) return 2;
  if (nameMatches) return 3;
  return 4;
}

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
      // The scan and matching happen in the trusted server runtime. The
      // browser receives only the bounded ranked result set.
      const clientQuery = branch
        ? getServerFirestore().collection('clients').where('branch', '==', branch)
        : getServerFirestore().collection('clients');
      const snapshot = await clientQuery.get();
      const matches = snapshot.docs
        .map((clientSnapshot) => {
          const client = serializeClient(clientSnapshot);
          return { client, score: scoreClient(client, search, branch) };
        })
        .filter(({ score }) => score >= 0)
        .sort((a, b) => a.score - b.score || String(a.client.name || '').localeCompare(String(b.client.name || '')))
        .slice(0, 100)
        .map(({ client }) => client);
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
