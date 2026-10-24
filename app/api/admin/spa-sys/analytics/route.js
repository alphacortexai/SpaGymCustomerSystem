import { NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/lib/firebase-server';
import { kampalaDateKey } from '@/lib/clientDataContract';
import { shiftDateKey } from '@/lib/spaSysActivity';
import { loadSpaSysAnalytics, loadSpaSysRequestLogs, webhookHost } from '@/lib/spaSysActivityStore';
import { listSpaSysIntegrations } from '@/lib/spaSysIntegrations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOP_ADMIN_EMAIL = 'alphacortexai@gmail.com';
const noStore = { 'Cache-Control': 'private, no-store' };

export async function GET(request) {
  const access = await authorizeAdminRequest(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: access.status, headers: noStore });
  }
  if (String(access.profile?.email || '').toLowerCase() !== TOP_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Only the top administrator can view API analytics.' }, { status: 403, headers: noStore });
  }
  const days = new URL(request.url).searchParams.get('days') === '30' ? 30 : 7;
  const to = kampalaDateKey();
  const from = shiftDateKey(to, -(days - 1));
  try {
    const integrations = await listSpaSysIntegrations();
    const [analytics, requestLogs] = await Promise.all([
      loadSpaSysAnalytics({
        from,
        to,
        integrations,
        environmentWebhookHost: webhookHost(process.env.SPA_SYS_WEBHOOK_URL || ''),
      }),
      loadSpaSysRequestLogs({ from, to }),
    ]);
    return NextResponse.json({
      ...analytics,
      entries: requestLogs.entries,
      logsTruncated: requestLogs.truncated,
      days,
    }, { headers: noStore });
  } catch (error) {
    console.error('Unable to read SPA SYS analytics:', error?.code || error?.message);
    return NextResponse.json({ error: 'Unable to load API analytics.' }, { status: 500, headers: noStore });
  }
}
