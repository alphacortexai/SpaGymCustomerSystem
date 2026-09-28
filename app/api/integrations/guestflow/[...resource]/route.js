import { NextResponse } from 'next/server';
import {
  ApiError,
  createClient,
  getSummary,
  isAuthorizedGuestFlowRequest,
  listBranches,
  listCheckIns,
  lookupClient,
  recordCheckIn,
  recordCheckOut,
  searchClients,
} from '@/lib/guestflowApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

async function handle(request, context) {
  if (!isAuthorizedGuestFlowRequest(request)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { resource = [] } = await context.params;
    const path = resource.join('/');
    const method = request.method;
    const url = new URL(request.url);

    if (path === 'branches' && method === 'GET') {
      return json({ branches: await listBranches() });
    }

    if (path === 'clients' && method === 'GET') {
      const phone = url.searchParams.get('phone') || '';
      const search = url.searchParams.get('search') || '';
      if (!phone && search.trim().length < 2) {
        return json({ error: 'Supply a phone number or at least two search characters.' }, 400);
      }
      const clients = await searchClients({ phone, search, limit: url.searchParams.get('limit') });
      return json({ clients });
    }

    if (path === 'clients/lookup' && method === 'GET') {
      const phone = url.searchParams.get('phone');
      if (!phone) return json({ error: 'Phone number is required.' }, 400);
      const client = await lookupClient(phone);
      return client ? json({ client }) : json({ error: 'No client record matches that phone number.', code: 'CLIENT_NOT_FOUND' }, 404);
    }

    if (path === 'clients' && method === 'POST') {
      const body = await request.json();
      const result = await createClient(body);
      return json(result, result.created ? 201 : 200);
    }

    if (path === 'check-ins' && method === 'POST') {
      const body = await request.json();
      const result = await recordCheckIn(body?.phone || body?.phoneNumber, body?.branchId || '');
      return json(result, result.alreadyCheckedIn ? 200 : 201);
    }

    if (path === 'check-ins' && method === 'GET') {
      const visits = await listCheckIns(url.searchParams.get('date') || undefined, url.searchParams.get('branchId') || '');
      return json({ visits });
    }

    if (path === 'check-ins/checkout' && (method === 'POST' || method === 'PATCH')) {
      const body = await request.json();
      if (!body?.id) return json({ error: 'Check-in id is required.' }, 400);
      const visit = await recordCheckOut(String(body.id), body.staffName);
      return json({ visit });
    }

    const checkoutMatch = path.match(/^check-ins\/([^/]+)\/checkout$/);
    if (checkoutMatch && (method === 'POST' || method === 'PATCH')) {
      const body = await request.json().catch(() => ({}));
      const visit = await recordCheckOut(decodeURIComponent(checkoutMatch[1]), body.staffName);
      return json({ visit });
    }

    if (path === 'summary' && method === 'GET') {
      return json(await getSummary(url.searchParams.get('branchId') || ''));
    }

    return json({ error: 'Endpoint not found.' }, 404);
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message, ...error.extra }, error.status);
    if (error instanceof SyntaxError) return json({ error: 'Request body must be valid JSON.' }, 400);
    console.error('GuestFlow integration API error:', error);
    return json({ error: 'Internal server error.' }, 500);
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
