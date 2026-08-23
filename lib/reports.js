'use client';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const REPORTS_COLLECTION = 'reports';

const toDateKey = (value = new Date()) => {
  if (typeof value === 'string') return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
};

const dateForStorage = (dateKey) => {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1, 12, 0, 0);
};

const readTimestamp = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const createReportId = (dateKey, ownerId) => `${toDateKey(dateKey)}__${ownerId}`;

export const createEmptyReport = ({ dateKey = toDateKey(), ownerId = '', ownerName = '', callerId = ownerId, callerName = ownerName, branch = '' } = {}) => ({
  id: createReportId(dateKey, ownerId || 'draft'),
  reportDateKey: toDateKey(dateKey),
  ownerId,
  ownerName,
  callerId,
  callerName,
  branch,
  birthdayClients: [],
  previousDayVisits: [],
  followUps: [],
  whatsappMessages: [],
  notes: '',
});

const normalizeRow = (row = {}, index = 0) => ({
  rowId: row.rowId || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  clientId: row.clientId || '',
  clientName: row.clientName || '',
  branch: row.branch || '',
  contactMethod: row.contactMethod || '',
  callerName: row.callerName || '',
  comment: row.comment || '',
  source: row.source || 'manual',
});

const normalizeReport = (data, id) => ({
  ...createEmptyReport({
    dateKey: data?.reportDateKey || toDateKey(),
    ownerId: data?.ownerId || '',
    ownerName: data?.ownerName || '',
    callerId: data?.callerId || data?.ownerId || '',
    callerName: data?.callerName || data?.ownerName || '',
    branch: data?.branch || '',
  }),
  ...data,
  id,
  birthdayClients: Array.isArray(data?.birthdayClients) ? data.birthdayClients.map(normalizeRow) : [],
  previousDayVisits: Array.isArray(data?.previousDayVisits) ? data.previousDayVisits.map(normalizeRow) : [],
  followUps: Array.isArray(data?.followUps) ? data.followUps.map(normalizeRow) : [],
  whatsappMessages: Array.isArray(data?.whatsappMessages) ? data.whatsappMessages.map(normalizeRow) : [],
  createdAt: readTimestamp(data?.createdAt),
  updatedAt: readTimestamp(data?.updatedAt),
});

export async function getReportForDate(dateKey, ownerId) {
  if (!dateKey || !ownerId) return null;
  try {
    const reportSnapshot = await getDoc(doc(db, REPORTS_COLLECTION, createReportId(dateKey, ownerId)));
    return reportSnapshot.exists() ? normalizeReport(reportSnapshot.data(), reportSnapshot.id) : null;
  } catch (error) {
    console.error('Error getting report:', error);
    return null;
  }
}

export async function getAllReports() {
  try {
    const reportsSnapshot = await getDocs(query(collection(db, REPORTS_COLLECTION), orderBy('reportDateKey', 'desc')));
    return reportsSnapshot.docs.map((reportDoc) => normalizeReport(reportDoc.data(), reportDoc.id));
  } catch (error) {
    console.error('Error getting reports:', error);
    try {
      const fallbackSnapshot = await getDocs(collection(db, REPORTS_COLLECTION));
      return fallbackSnapshot.docs
        .map((reportDoc) => normalizeReport(reportDoc.data(), reportDoc.id))
        .sort((a, b) => String(b.reportDateKey).localeCompare(String(a.reportDateKey)));
    } catch (fallbackError) {
      console.error('Error getting reports fallback:', fallbackError);
      return [];
    }
  }
}

export async function saveReport(report, currentUser, profile) {
  if (!currentUser?.uid) return { success: false, error: 'You must be signed in to save a report.' };
  const dateKey = toDateKey(report?.reportDateKey);
  const reportId = createReportId(dateKey, currentUser.uid);
  const existingSnapshot = await getDoc(doc(db, REPORTS_COLLECTION, reportId));
  const now = Timestamp.now();
  const payload = {
    reportDateKey: dateKey,
    reportDate: Timestamp.fromDate(dateForStorage(dateKey)),
    ownerId: currentUser.uid,
    ownerName: currentUser.displayName || currentUser.email || profile?.displayName || 'Staff member',
    ownerEmail: currentUser.email || '',
    callerId: report?.callerId || currentUser.uid,
    callerName: report?.callerName || currentUser.displayName || currentUser.email || 'Caller',
    branch: report?.branch || '',
    birthdayClients: Array.isArray(report?.birthdayClients) ? report.birthdayClients.map(normalizeRow) : [],
    previousDayVisits: Array.isArray(report?.previousDayVisits) ? report.previousDayVisits.map(normalizeRow) : [],
    followUps: Array.isArray(report?.followUps) ? report.followUps.map(normalizeRow) : [],
    whatsappMessages: Array.isArray(report?.whatsappMessages) ? report.whatsappMessages.map(normalizeRow) : [],
    notes: report?.notes || '',
    createdAt: existingSnapshot.exists() ? (existingSnapshot.data().createdAt || now) : now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, REPORTS_COLLECTION, reportId), payload, { merge: true });
    return { success: true, report: normalizeReport(payload, reportId) };
  } catch (error) {
    console.error('Error saving report:', error);
    return { success: false, error: error.message || 'Unable to save report.' };
  }
}

export { toDateKey };
