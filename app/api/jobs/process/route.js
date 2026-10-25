import { NextResponse } from 'next/server';
import { authorizeAdminRequest, getServerFirestore } from '@/lib/firebase-server';
import { processExcelFile, updateJobProgress } from '@/lib/jobProcessor';

export const runtime = 'nodejs';
export const maxDuration = 300;

const JOB_ID = /^job_[A-Za-z0-9_]+$/;

function denied(access) {
  return NextResponse.json(
    { error: access.status === 403 ? 'Forbidden' : 'Unauthorized' },
    { status: access.status }
  );
}

export async function POST(request) {
  const access = await authorizeAdminRequest(request);
  if (!access.ok) return denied(access);

  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId || !JOB_ID.test(jobId)) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const jobRef = getServerFirestore().collection('importJobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobData = jobSnap.data();

    if (jobData.status === 'processing' || jobData.status === 'importing') {
      return NextResponse.json({
        success: true,
        message: 'Job is already being processed',
        status: jobData.status,
      });
    }

    if (jobData.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Job is already completed',
        status: jobData.status,
      });
    }

    const jsonData = jobData.jsonData || [];
    const defaultBranch = jobData.defaultBranch || '';

    if (!jsonData || jsonData.length === 0) {
      if (!jobData.dataStored) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const retrySnap = await jobRef.get();
        if (retrySnap.exists) {
          const retryData = retrySnap.data();
          if (retryData.jsonData && retryData.jsonData.length > 0) {
            try {
              await processExcelFile(jobId, retryData.jsonData, retryData.defaultBranch || '');
              return NextResponse.json({ success: true, message: 'Job processing completed' });
            } catch (processError) {
              console.error('Error processing job:', processError);
              try {
                await updateJobProgress(jobId, {
                  status: 'failed',
                  error: 'The import could not be completed.',
                });
              } catch (updateError) {
                console.error('Failed to update job status:', updateError);
              }
              return NextResponse.json({ error: 'Job processing failed.', success: false }, { status: 500 });
            }
          }
        }
      }

      return NextResponse.json(
        { error: 'No data found in job. Please re-upload the file.' },
        { status: 400 }
      );
    }

    try {
      await processExcelFile(jobId, jsonData, defaultBranch);
      return NextResponse.json({ success: true, message: 'Job processing completed' });
    } catch (processError) {
      console.error('Error processing job:', processError);
      try {
        await updateJobProgress(jobId, {
          status: 'failed',
          error: 'The import could not be completed.',
        });
      } catch (updateError) {
        console.error('Failed to update job status:', updateError);
      }
      return NextResponse.json({ error: 'Job processing failed.', success: false }, { status: 500 });
    }
  } catch (error) {
    console.error('Process job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
