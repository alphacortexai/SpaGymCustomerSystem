import { NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/lib/firebase-server';
import { createImportJob, processExcelFile } from '@/lib/jobProcessor';
import { readFirstSheetRows } from '@/lib/spreadsheet';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    const formData = await request.formData();
    const file = formData.get('file');
    const defaultBranch = formData.get('defaultBranch') || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name || '';
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'xlsx') {
      return NextResponse.json(
        { error: 'Invalid file type. Save the spreadsheet as .xlsx and upload that file.' },
        { status: 400 }
      );
    }

    const fileSize = file.size;
    const maxSize = 10 * 1024 * 1024;
    if (fileSize > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds limit. Maximum size is ${maxSize / (1024 * 1024)}MB. Your file is ${(fileSize / (1024 * 1024)).toFixed(2)}MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let jsonData;
    try {
      jsonData = (await readFirstSheetRows(buffer)).map((row) => Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])
      ));
    } catch (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to read Excel file. Please ensure it is a valid .xlsx file.' },
        { status: 400 }
      );
    }

    const jobResult = await createImportJob(fileName, access.uid);
    if (!jobResult.success) {
      console.error('Failed to create import job:', jobResult.error);
      return NextResponse.json({ error: 'Failed to create import job.' }, { status: 500 });
    }

    const { jobId } = jobResult;
    try {
      const { getServerFirestore } = await import('@/lib/firebase-server');
      await getServerFirestore().collection('importJobs').doc(jobId).update({
        jsonData,
        defaultBranch,
        dataStored: true,
        total: jsonData.length,
      });
    } catch (storageError) {
      console.error('Error storing job data:', storageError);
      return NextResponse.json({ error: 'Failed to store job data.' }, { status: 500 });
    }

    if (!process.env.VERCEL) {
      (async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 100));
          await processExcelFile(jobId, jsonData, defaultBranch);
        } catch (error) {
          console.error('Background processing error:', error);
          try {
            const { updateJobProgress } = await import('@/lib/jobProcessor');
            await updateJobProgress(jobId, {
              status: 'failed',
              error: 'The import could not be completed.',
            });
          } catch (updateError) {
            console.error('Failed to update job status:', updateError);
          }
        }
      })();
    }

    return NextResponse.json({
      success: true,
      jobId,
      message: 'File uploaded successfully. Processing started in background.',
      totalRows: jsonData.length,
    });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
