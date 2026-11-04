import { NextResponse } from 'next/server';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { authorizeAdminRequest, getServerFirestore } from '@/lib/firebase-server';
import {
  buildCustomerProfileExport,
  customerProfileExportReply,
  customerProfileExportSummary,
} from '@/lib/customerProfileExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TOP_ADMIN_EMAIL = 'alphacortexai@gmail.com';
const PAGE_SIZE = 500;
const noStore = { 'Cache-Control': 'private, no-store' };

function denied(access) {
  const status = access.status === 403 ? 403 : 401;
  return NextResponse.json(
    { error: status === 403 ? 'Forbidden' : 'Unauthorized' },
    { status, headers: noStore },
  );
}

async function readEveryCustomer(db) {
  const records = [];
  let query = db.collection('clients').orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
  while (true) {
    const snapshot = await query.get();
    if (snapshot.empty) break;
    snapshot.docs.forEach((customer) => {
      records.push({ id: customer.id, ...customer.data() });
    });
    if (snapshot.size < PAGE_SIZE) break;
    query = db.collection('clients').orderBy(FieldPath.documentId()).startAfter(snapshot.docs.at(-1)).limit(PAGE_SIZE);
  }
  return records;
}

async function recordExport(db, access, count) {
  try {
    await db.collection('timeline').add({
      userId: access.uid,
      userName: access.profile?.displayName || access.email,
      userEmail: access.email,
      action: 'EXPORT',
      targetType: 'CLIENT',
      targetId: 'customer-profile-export',
      targetName: 'Customer profile export',
      details: `Exported ${count} customer profiles as JSON`,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Unable to record the customer profile export:', error?.code || error?.message);
  }
}

export async function GET(request) {
  const access = await authorizeAdminRequest(request);
  if (!access.ok) return denied(access);
  if (String(access.email || '').toLowerCase() !== TOP_ADMIN_EMAIL) {
    return NextResponse.json(
      { error: 'Only the top administrator can export customer profiles.' },
      { status: 403, headers: noStore },
    );
  }

  const summaryOnly = new URL(request.url).searchParams.get('summary') === '1';
  try {
    const db = getServerFirestore();
    if (summaryOnly) {
      const counted = await db.collection('clients').count().get();
      const countedAt = new Date().toISOString();
      const summary = customerProfileExportSummary(buildCustomerProfileExport([], { exportedAt: countedAt }));
      summary.count = counted.data().count;
      summary.reply = customerProfileExportReply({ count: summary.count });
      delete summary.exportedAt;
      return NextResponse.json(summary, { headers: noStore });
    }

    const exportDocument = buildCustomerProfileExport(await readEveryCustomer(db), {
      exportedAt: new Date().toISOString(),
    });
    await recordExport(db, access, exportDocument.count);
    return NextResponse.json({
      ...exportDocument,
      reply: customerProfileExportReply({
        count: exportDocument.count,
        exportedAt: exportDocument.exportedAt,
      }),
    }, { headers: noStore });
  } catch (error) {
    console.error('Unable to export customer profiles:', error?.code || error?.message);
    return NextResponse.json({ error: 'Unable to export customer profiles.' }, { status: 500, headers: noStore });
  }
}
