'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { bulkAddClients, checkDuplicatePhone } from '@/lib/clients';
import { getAllBranches, branchExists } from '@/lib/branches';

export default function ExcelUpload({ onClientsAdded }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState(null);
  const [defaultBranch, setDefaultBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [skippedClients, setSkippedClients] = useState([]);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    const branchList = await getAllBranches();
    setBranches(branchList);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          if (jsonData.length === 0) {
            setError('Excel file is empty');
            setLoading(false);
            return;
          }

          // Preview first few rows
          setPreview(jsonData.slice(0, 5));

          // Map Excel columns to our format
          // Try to detect column names (case-insensitive)
          const validClients = [];
          const skipped = [];
          const seenPhoneNumbers = new Set(); // Track phone numbers within Excel file
          
          for (let index = 0; index < jsonData.length; index++) {
            const row = jsonData[index];
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
            const phoneNumber = phoneKey ? String(row[phoneKey] || '').trim() : '';
            let dateOfBirth = '';
            let birthMonth = null;
            let birthDay = null;

            if (dobKey) {
              const dobValue = row[dobKey];
              if (dobValue) {
                let parsedDate = null;
                
                // Handle Excel date serial number (days since 1900-01-01)
                if (typeof dobValue === 'number') {
                  // Excel date serial number
                  const excelEpoch = new Date(1899, 11, 30);
                  parsedDate = new Date(excelEpoch.getTime() + dobValue * 24 * 60 * 60 * 1000);
                  if (isNaN(parsedDate.getTime())) {
                    parsedDate = null;
                  }
                } else if (dobValue instanceof Date) {
                  // Already a Date object
                  parsedDate = dobValue;
                } else {
                  // Try to parse as date string
                  parsedDate = new Date(dobValue);
                  if (isNaN(parsedDate.getTime())) {
                    // Try common date formats
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
                  // Extract month and day (ignore year)
                  birthMonth = parsedDate.getMonth() + 1; // JavaScript months are 0-indexed
                  birthDay = parsedDate.getDate();
                  
                  // Create date with current year for storage (matching form behavior)
                  const currentYear = new Date().getFullYear();
                  const dateForStorage = new Date(currentYear, birthMonth - 1, birthDay);
                  dateOfBirth = dateForStorage.toISOString().split('T')[0];
                } else {
                  // If we can't parse, try to extract month/day from string format like "MM/DD" or "MM-DD"
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

            if (!name || !phoneNumber || !dateOfBirth) {
              skipped.push({
                row: index + 2,
                name: name || 'N/A',
                reason: 'Missing required data (Name, Phone Number, or Date of Birth)'
              });
              continue;
            }

            // Use branch from Excel if available, otherwise use default branch
            const branch = branchKey ? String(row[branchKey] || '').trim() : (defaultBranch.trim() || '');

            if (!branch) {
              skipped.push({
                row: index + 2,
                name: name,
                reason: 'Missing branch. Either include Branch column in Excel or set a default branch above.'
              });
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
              continue;
            }

            // Check for duplicate phone number within Excel file
            const phoneBranchKey = `${phoneNumber.trim()}_${branch.trim()}`;
            if (seenPhoneNumbers.has(phoneBranchKey)) {
              skipped.push({
                row: index + 2,
                name: name,
                phoneNumber: phoneNumber,
                reason: `Duplicate phone number "${phoneNumber}" found in Excel file (same branch)`
              });
              continue;
            }

            // Check for duplicate phone number in database
            const existsInDB = await checkDuplicatePhone(phoneNumber, branch);
            if (existsInDB) {
              skipped.push({
                row: index + 2,
                name: name,
                phoneNumber: phoneNumber,
                reason: `Phone number "${phoneNumber}" already exists in database (same branch)`
              });
              continue;
            }

            // Mark this phone number as seen
            seenPhoneNumbers.add(phoneBranchKey);

            validClients.push({ 
              name, 
              phoneNumber, 
              dateOfBirth, 
              branch,
              birthMonth,
              birthDay
            });
          }

          // Set skipped information
          setSkippedCount(skipped.length);
          setSkippedClients(skipped);

          if (validClients.length === 0) {
            setError(`No valid clients to import. All ${jsonData.length} row(s) were skipped.`);
            setLoading(false);
            return;
          }

          // Add valid clients to database
          const results = await bulkAddClients(validClients);
          const successCount = results.filter(r => r.success).length;
          const failCount = results.filter(r => !r.success).length;

          let message = `Successfully imported ${successCount} client(s).`;
          if (failCount > 0) {
            message += ` ${failCount} failed.`;
          }
          if (skipped.length > 0) {
            message += ` ${skipped.length} row(s) skipped (invalid branches or missing data).`;
          }

          setSuccess(message);
          setPreview(null);
          
          if (onClientsAdded) {
            onClientsAdded();
          }
        } catch (err) {
          setError(err.message || 'Error processing Excel file');
          console.error(err);
        } finally {
          setLoading(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError('Error reading file');
      setLoading(false);
      console.error(err);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Upload Excel File</h2>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          Upload an Excel file (.xlsx, .xls) with columns: <strong>Name</strong>, <strong>Phone Number</strong>, <strong>Date of Birth</strong>, and <strong>Branch</strong> (optional - use default below if missing)
        </p>
        <p className="text-xs text-yellow-600 mb-3">
          ⚠️ Note: Clients with invalid or non-existent branches will be skipped during import.
        </p>
        <div className="mb-3">
          <label htmlFor="defaultBranch" className="block text-sm font-medium text-gray-700 mb-1">
            Default Branch (if not in Excel file)
          </label>
          <select
            id="defaultBranch"
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select default branch (optional)</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          disabled={loading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {skippedCount > 0 && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
          <p className="font-semibold mb-2">⚠️ {skippedCount} row(s) skipped:</p>
          <ul className="list-disc list-inside text-sm space-y-1 max-h-40 overflow-y-auto">
            {skippedClients.map((item, idx) => (
              <li key={idx}>
                Row {item.row}: {item.name} - {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && (
        <div className="text-center py-4">
          <p className="text-gray-600">Processing file...</p>
        </div>
      )}

      {preview && preview.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Preview (first 5 rows):</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(preview[0]).map((key) => (
                    <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {preview.map((row, idx) => (
                  <tr key={idx}>
                    {Object.values(row).map((value, valIdx) => (
                      <td key={valIdx} className="px-3 py-2 text-gray-700">
                        {String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

