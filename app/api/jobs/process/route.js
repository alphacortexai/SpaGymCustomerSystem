import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { processExcelFile, updateJobProgress } from '@/lib/jobProcessor';

// Configure runtime for better performance on Vercel
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for processing

export async function POST(request) {
  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get job data from Firestore
    const jobRef = doc(db, 'importJobs', jobId);
    const jobSnap = await getDoc(jobRef);

    if (!jobSnap.exists()) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const jobData = jobSnap.data();

    // Check if job is already processing or completed
    // Allow restarting if status is 'failed' or 'pending'
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

    // Get JSON data and default branch from stored job data
    const jsonData = jobData.jsonData || [];
    const defaultBranch = jobData.defaultBranch || '';

    if (!jsonData || jsonData.length === 0) {
      // If data isn't stored yet, wait a moment and retry once
      if (!jobData.dataStored) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retrySnap = await getDoc(jobRef);
        if (retrySnap.exists()) {
          const retryData = retrySnap.data();
          if (retryData.jsonData && retryData.jsonData.length > 0) {
            // Data is now available, proceed with retry data
            const retryJsonData = retryData.jsonData;
            const retryDefaultBranch = retryData.defaultBranch || '';
            
            try {
              await processExcelFile(jobId, retryJsonData, retryDefaultBranch);
              return NextResponse.json({
                success: true,
                message: 'Job processing completed',
              });
            } catch (processError) {
              console.error('Error processing job:', processError);
              try {
                await updateJobProgress(jobId, {
                  status: 'failed',
                  error: processError.message || 'Unknown error during processing',
                });
              } catch (updateError) {
                console.error('Failed to update job status:', updateError);
              }
              return NextResponse.json(
                { 
                  error: 'Job processing failed: ' + (processError.message || 'Unknown error'),
                  success: false 
                },
                { status: 500 }
              );
            }
          }
        }
      }
      
      return NextResponse.json(
        { error: 'No data found in job. Please re-upload the file.' },
        { status: 400 }
      );
    }

    // Process the job - this will run to completion
    // The function has maxDuration of 300 seconds (5 minutes) which should be enough
    try {
      await processExcelFile(jobId, jsonData, defaultBranch);
      
      return NextResponse.json({
        success: true,
        message: 'Job processing completed',
      });
    } catch (processError) {
      console.error('Error processing job:', processError);
      
      // Update job status to failed
      try {
        await updateJobProgress(jobId, {
          status: 'failed',
          error: processError.message || 'Unknown error during processing',
        });
      } catch (updateError) {
        console.error('Failed to update job status:', updateError);
      }
      
      return NextResponse.json(
        { 
          error: 'Job processing failed: ' + (processError.message || 'Unknown error'),
          success: false 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Process job error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

