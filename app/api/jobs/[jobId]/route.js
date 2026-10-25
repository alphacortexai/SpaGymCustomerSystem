import { NextResponse } from 'next/server';
import { authorizeAdminRequest, getServerFirestore } from '@/lib/firebase-server';

export const runtime = 'nodejs';

const JOB_ID = /^job_[A-Za-z0-9_]+$/;

export async function GET(request, context) {
  const access = await authorizeAdminRequest(request);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 403 ? 'Forbidden' : 'Unauthorized' },
      { status: access.status }
    );
  }

  try {
    const { jobId } = await context.params;

    if (!jobId || !JOB_ID.test(jobId)) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const jobSnap = await getServerFirestore().collection('importJobs').doc(jobId).get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobData = jobSnap.data();
    const asIso = (value) => value?.toDate?.()?.toISOString?.() || null;

    return NextResponse.json({
      jobId: jobData.jobId,
      fileName: jobData.fileName,
      status: jobData.status,
      progress: jobData.progress || 0,
      total: jobData.total || 0,
      processed: jobData.processed || 0,
      success: jobData.success || 0,
      failed: jobData.failed || 0,
      skipped: jobData.skipped || 0,
      skippedDetails: jobData.skippedDetails || [],
      errors: jobData.errors || [],
      message: jobData.message || '',
      error: jobData.error || null,
      createdAt: asIso(jobData.createdAt),
      updatedAt: asIso(jobData.updatedAt),
    });
  } catch (error) {
    console.error('Get job status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
