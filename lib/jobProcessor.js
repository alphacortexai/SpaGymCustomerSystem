/**
 * Server-side Excel processing utility
 * Processes Excel files and imports clients to Firestore
 */

import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  Timestamp,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { normalizePhoneNumberWithAll, extractAllPhoneNumbers } from './phoneUtils';
import { addClient, checkDuplicatePhone } from './clients';
import { addUnrecognizedClient } from './unrecognizedClients';
import { branchExists } from './branches';

const JOBS_COLLECTION = 'importJobs';

/**
 * Create a new import job in Firestore
 */
export async function createImportJob(fileName, userId = null) {
  try {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const jobRef = doc(db, JOBS_COLLECTION, jobId);
    
    const jobData = {
      jobId,
      fileName,
      status: 'pending',
      progress: 0,
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      skippedDetails: [],
      errors: [],
      userId: userId || null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    await setDoc(jobRef, jobData);
    return { success: true, jobId };
  } catch (error) {
    console.error('Error creating import job:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update job progress
 */
export async function updateJobProgress(jobId, updates) {
  try {
    const jobRef = doc(db, JOBS_COLLECTION, jobId);
    await updateDoc(jobRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating job progress:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Process Excel file and import clients
 * This runs server-side asynchronously
 */
export async function processExcelFile(jobId, jsonData, defaultBranch = '') {
  try {
    // Update status to processing
    await updateJobProgress(jobId, {
      status: 'processing',
      total: jsonData.length,
      progress: 0,
    });

    const validClients = [];
    const skipped = [];
    const seenPhoneNumbers = new Set();
    let processed = 0;
    let success = 0;
    let failed = 0;
    let skippedCount = 0;

    // Process each row
    for (let index = 0; index < jsonData.length; index++) {
      const row = jsonData[index];
      
      try {
        // Extract column data
        const nameKey = Object.keys(row).find(
          key => key.toLowerCase().includes('name')
        );
        const phoneKey = Object.keys(row).find(
          key => key.toLowerCase().includes('phone') || key.toLowerCase().includes('mobile')
        );
        const dobKey = Object.keys(row).find(
          key => key.toLowerCase().includes('dob') || 
                 key.toLowerCase().includes('birth') ||
                 key.toLowerCase().includes('date')
        );
        const branchKey = Object.keys(row).find(
          key => key.toLowerCase().includes('branch')
        );

        const name = nameKey ? String(row[nameKey] || '').trim() : '';
        const rawPhoneNumber = phoneKey ? String(row[phoneKey] || '').trim() : '';
        const phoneData = normalizePhoneNumberWithAll(rawPhoneNumber);
        const phoneNumber = phoneData.storage;
        let dateOfBirth = '';
        let birthMonth = null;
        let birthDay = null;

        // Parse date of birth
        if (dobKey) {
          const dobValue = row[dobKey];
          if (dobValue) {
            let parsedDate = null;
            
            if (typeof dobValue === 'number') {
              // Excel date serial number
              const excelEpoch = new Date(1899, 11, 30);
              parsedDate = new Date(excelEpoch.getTime() + dobValue * 24 * 60 * 60 * 1000);
              if (isNaN(parsedDate.getTime())) {
                parsedDate = null;
              }
            } else if (dobValue instanceof Date) {
              parsedDate = dobValue;
            } else {
              parsedDate = new Date(dobValue);
              if (isNaN(parsedDate.getTime())) {
                const dateStr = String(dobValue).trim();
                const dateMatch = dateStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
                if (dateMatch) {
                  parsedDate = new Date(
                    parseInt(dateMatch[1]),
                    parseInt(dateMatch[2]) - 1,
                    parseInt(dateMatch[3])
                  );
                } else {
                  parsedDate = null;
                }
              }
            }

            if (parsedDate && !isNaN(parsedDate.getTime())) {
              birthMonth = parsedDate.getMonth() + 1;
              birthDay = parsedDate.getDate();
              const currentYear = new Date().getFullYear();
              const dateForStorage = new Date(currentYear, birthMonth - 1, birthDay);
              dateOfBirth = dateForStorage.toISOString().split('T')[0];
            } else {
              const dateStr = String(dobValue).trim();
              const monthDayMatch = dateStr.match(/(\d{1,2})[-\/](\d{1,2})/);
              if (monthDayMatch) {
                birthMonth = parseInt(monthDayMatch[1]);
                birthDay = parseInt(monthDayMatch[2]);
                const currentYear = new Date().getFullYear();
                const dateForStorage = new Date(currentYear, birthMonth - 1, birthDay);
                if (!isNaN(dateForStorage.getTime())) {
                  dateOfBirth = dateForStorage.toISOString().split('T')[0];
                }
              }
            }
          }
        }

        // Validate required fields
        if (!name) {
          skipped.push({
            row: index + 2,
            name: name || 'N/A',
            reason: 'Missing required data (Name)'
          });
          skippedCount++;
          processed++;
          continue;
        }
        
        // Handle unrecognized phone numbers
        if (phoneData.hasUnrecognized && phoneData.validNumbers.length === 0) {
          await addUnrecognizedClient({
            name: name,
            phoneNumber: rawPhoneNumber,
            invalidPhoneNumbers: phoneData.invalidPhoneNumbers,
            dateOfBirth: dateOfBirth,
            birthMonth: birthMonth,
            birthDay: birthDay,
            branch: '',
            reason: `Unrecognized phone number format: ${phoneData.invalidPhoneNumbers.join(', ')}`,
            source: 'excel',
          });
          skipped.push({
            row: index + 2,
            name: name,
            phoneNumber: rawPhoneNumber,
            reason: `Unrecognized phone number format. Saved to "Unrecognised Uploaded Client Data" for review.`
          });
          skippedCount++;
          processed++;
          continue;
        }
        
        if (!phoneNumber && !rawPhoneNumber) {
          skipped.push({
            row: index + 2,
            name: name || 'N/A',
            reason: 'Missing phone number'
          });
          skippedCount++;
          processed++;
          continue;
        }

        // Get branch
        const branch = branchKey ? String(row[branchKey] || '').trim() : (defaultBranch.trim() || '');

        if (!branch) {
          skipped.push({
            row: index + 2,
            name: name,
            reason: 'Missing branch. Either include Branch column in Excel or set a default branch.'
          });
          skippedCount++;
          processed++;
          continue;
        }

        // Validate branch exists
        const branchValid = await branchExists(branch);
        if (!branchValid) {
          skipped.push({
            row: index + 2,
            name: name,
            branch: branch,
            reason: `Branch "${branch}" does not exist`
          });
          skippedCount++;
          processed++;
          continue;
        }

        // Check for duplicates within Excel file
        const allNumbers = extractAllPhoneNumbers(rawPhoneNumber);
        let foundDuplicate = false;
        for (const num of allNumbers) {
          const phoneBranchKey = `${num}_${branch.trim()}`;
          if (seenPhoneNumbers.has(phoneBranchKey)) {
            foundDuplicate = true;
            break;
          }
        }
        
        if (foundDuplicate) {
          const numbersDisplay = allNumbers.length > 1 
            ? allNumbers.join(', ') 
            : phoneNumber;
          skipped.push({
            row: index + 2,
            name: name,
            phoneNumber: rawPhoneNumber,
            reason: `Duplicate phone number(s) "${numbersDisplay}" found in Excel file (same branch)`
          });
          skippedCount++;
          processed++;
          continue;
        }
        
        // Mark phone numbers as seen
        for (const num of allNumbers) {
          const phoneBranchKey = `${num}_${branch.trim()}`;
          seenPhoneNumbers.add(phoneBranchKey);
        }

        // Check for duplicates in database
        const existsInDB = await checkDuplicatePhone(rawPhoneNumber, branch);
        if (existsInDB) {
          const allNumbers = extractAllPhoneNumbers(rawPhoneNumber);
          const numbersDisplay = allNumbers.length > 1 
            ? allNumbers.join(', ') 
            : phoneNumber;
          skipped.push({
            row: index + 2,
            name: name,
            phoneNumber: rawPhoneNumber,
            reason: `Phone number(s) "${numbersDisplay}" already exist(s) in database (same branch)`
          });
          skippedCount++;
          processed++;
          continue;
        }

        // Handle partial unrecognized numbers
        if (phoneData.hasUnrecognized && phoneData.invalidPhoneNumbers.length > 0 && phoneData.validNumbers.length > 0) {
          await addUnrecognizedClient({
            name: name,
            phoneNumber: rawPhoneNumber,
            invalidPhoneNumbers: phoneData.invalidPhoneNumbers,
            dateOfBirth: dateOfBirth,
            birthMonth: birthMonth,
            birthDay: birthDay,
            branch: branch,
            reason: `Some phone numbers unrecognized: ${phoneData.invalidPhoneNumbers.join(', ')}. Valid numbers (${phoneData.validNumbers.join(', ')}) will be saved.`,
            source: 'excel',
          });
        }

        // Add to valid clients
        validClients.push({ 
          name, 
          phoneNumber,
          dateOfBirth, 
          branch,
          birthMonth,
          birthDay
        });

        processed++;
      } catch (error) {
        failed++;
        processed++;
        console.error(`Error processing row ${index + 2}:`, error);
      }

      // Update progress every 10 rows or on last row
      if (index % 10 === 0 || index === jsonData.length - 1) {
        const percentage = Math.round((processed / jsonData.length) * 100);
        await updateJobProgress(jobId, {
          processed,
          progress: percentage,
          skipped: skippedCount,
          failed,
        });
      }
    }

    // Update job with skipped details
    await updateJobProgress(jobId, {
      skippedDetails: skipped,
    });

    // Import valid clients
    if (validClients.length === 0) {
      await updateJobProgress(jobId, {
        status: 'completed',
        message: `No valid clients to import. All ${jsonData.length} row(s) were skipped.`,
      });
      return { success: true, validClients: 0, skipped: skippedCount };
    }

    // Update status to importing
    await updateJobProgress(jobId, {
      status: 'importing',
      processed: 0,
      progress: 0,
    });

    // Import clients one by one
    for (let i = 0; i < validClients.length; i++) {
      try {
        const result = await addClient(validClients[i]);
        if (result.success) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        console.error(`Error importing client ${i + 1}:`, error);
      }

      // Update progress every 10 clients or on last client
      if (i % 10 === 0 || i === validClients.length - 1) {
        const percentage = Math.round(((i + 1) / validClients.length) * 100);
        await updateJobProgress(jobId, {
          processed: i + 1,
          progress: percentage,
          success,
          failed,
        });
      }
    }

    // Mark as completed
    await updateJobProgress(jobId, {
      status: 'completed',
      processed: validClients.length,
      progress: 100,
      success,
      failed,
      skipped: skippedCount,
      message: `Successfully imported ${success} client(s). ${failed} failed. ${skippedCount} skipped.`,
    });

    return { 
      success: true, 
      validClients: success, 
      failed, 
      skipped: skippedCount 
    };

  } catch (error) {
    console.error('Error processing Excel file:', error);
    await updateJobProgress(jobId, {
      status: 'failed',
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

