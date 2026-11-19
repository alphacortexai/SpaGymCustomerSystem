'use client';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  COLLABORATED_REPORT_TYPE,
  buildCollaboratedSave,
  createCollaboratedReportId,
  normalizeCollaboration,
} from './reportCollaboration';

const REPORTS_COLLECTION = 'reports';
const DEFAULT_REPORT_TYPE = 'feedback-birthdays-whatsapp-calls';

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
  reportType: DEFAULT_REPORT_TYPE,
  ownerId,
  ownerName,
  callerId,
  callerName,
  branch,
  collaboration: null,
  includeUncalledBirthdays: false,
  birthdayClients: [],
  previousDayVisits: [],
  followUps: [],
  whatsappMessages: [],
  customColumns: [],
  notes: '',
});

const normalizeRow = (row = {}, index = 0) => ({
  rowId: row.rowId || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  clientId: row.clientId || '',
  clientName: row.clientName || '',
  phoneNumber: row.phoneNumber || '',
  branch: row.branch || '',
  contactMethod: row.contactMethod || '',
  callerName: row.callerName || '',
  comment: row.comment || '',
  customFields: row.customFields && typeof row.customFields === 'object' ? row.customFields : {},
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
  reportType: data?.reportType || DEFAULT_REPORT_TYPE,
  collaboration: normalizeCollaboration(data?.collaboration),
  id,
  birthdayClients: Array.isArray(data?.birthdayClients) ? data.birthdayClients.map(normalizeRow) : [],
  previousDayVisits: Array.isArray(data?.previousDayVisits) ? data.previousDayVisits.map(normalizeRow) : [],
  followUps: Array.isArray(data?.followUps) ? data.followUps.map(normalizeRow) : [],
  whatsappMessages: Array.isArray(data?.whatsappMessages) ? data.whatsappMessages.map(normalizeRow) : [],
  customColumns: Array.isArray(data?.customColumns) ? data.customColumns.filter((column) => column?.id && column?.label).map((column) => ({ id: String(column.id), label: String(column.label) })) : [],
  createdAt: readTimestamp(data?.createdAt),
  updatedAt: readTimestamp(data?.updatedAt),
});

export async function getReportById(reportId) {
  if (!reportId) return null;
  try {
    const reportSnapshot = await getDoc(doc(db, REPORTS_COLLECTION, reportId));
    return reportSnapshot.exists() ? normalizeReport(reportSnapshot.data(), reportSnapshot.id) : null;
  } catch (error) {
    console.error('Error getting report:', error);
    return null;
  }
}

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

const isApprovedAdmin = (profile) => profile?.role === 'Admin' && profile?.status === 'approved';

async function saveCollaboratedReport(report, currentUser, profile, editingCallerId) {
  const dateKey = toDateKey(report?.reportDateKey);
  const branch = report.branch.trim();
  const reportId = createCollaboratedReportId({
    dateKey,
    branch,
    birthdayCallerId: report?.collaboration?.birthday?.callerId,
    feedbackCallerId: report?.collaboration?.feedback?.callerId,
  });
  if (report?.id && report.id.startsWith('collab__') && report.id !== reportId) {
    return { success: false, error: 'This collaborated report does not match its callers, date, and branch.' };
  }
  const reportRef = doc(db, REPORTS_COLLECTION, reportId);
  const existingSnapshot = await getDoc(reportRef);
  const raw = existingSnapshot.exists() ? existingSnapshot.data() : null;
  const decision = buildCollaboratedSave({
    existing: raw ? {
      collaboration: raw.collaboration,
      birthdayClients: raw.birthdayClients || [],
      previousDayVisits: [...(raw.previousDayVisits || []), ...(raw.followUps || [])],
      notes: raw.notes || '',
      customColumns: raw.customColumns || [],
    } : null,
    incoming: {
      ...report,
      birthdayClients: Array.isArray(report?.birthdayClients) ? report.birthdayClients : [],
      previousDayVisits: [...(Array.isArray(report?.previousDayVisits) ? report.previousDayVisits : []), ...(Array.isArray(report?.followUps) ? report.followUps : [])],
    },
    userId: currentUser.uid,
    callerId: editingCallerId || report?.callerId || '',
    isAdmin: isApprovedAdmin(profile),
  });
  if (!decision.ok) return { success: false, error: decision.error };

  const now = Timestamp.now();
  const payload = {
    reportDateKey: raw?.reportDateKey || dateKey,
    reportType: COLLABORATED_REPORT_TYPE,
    reportDate: raw?.reportDate || Timestamp.fromDate(dateForStorage(dateKey)),
    ownerId: raw?.ownerId || currentUser.uid,
    ownerName: raw?.ownerName || currentUser.displayName || currentUser.email || profile?.displayName || 'Staff member',
    ownerEmail: raw?.ownerEmail || currentUser.email || '',
    callerId: raw?.callerId || editingCallerId || report?.callerId || currentUser.uid,
    callerName: raw?.callerName || report?.callerName || currentUser.displayName || currentUser.email || 'Caller',
    branch: raw?.branch || branch,
    collaboration: decision.collaboration,
    includeUncalledBirthdays: raw
      ? (isApprovedAdmin(profile) ? Boolean(report?.includeUncalledBirthdays) : Boolean(raw.includeUncalledBirthdays))
      : Boolean(report?.includeUncalledBirthdays && isApprovedAdmin(profile)),
    birthdayClients: decision.birthdayFromIncoming ? (decision.birthdayClients || []).map(normalizeRow) : (raw?.birthdayClients || []),
    previousDayVisits: decision.feedbackFromIncoming ? (decision.previousDayVisits || []).map(normalizeRow) : (raw?.previousDayVisits || []),
    followUps: decision.feedbackFromIncoming ? [] : (raw?.followUps || []),
    whatsappMessages: raw?.whatsappMessages || [],
    customColumns: decision.customColumns,
    notes: decision.notes || '',
    createdAt: raw?.createdAt || now,
    updatedAt: now,
  };

  try {
    await setDoc(reportRef, payload);
    return { success: true, report: normalizeReport(payload, reportId) };
  } catch (error) {
    console.error('Error saving collaborated report:', error);
    const permissionDenied = /permission|insufficient/i.test(error?.message || '');
    return {
      success: false,
      error: permissionDenied
        ? 'Your section could not be saved because the shared report changed. Open it again, then save your section.'
        : (error.message || 'Unable to save report.'),
    };
  }
}

export async function saveReport(report, currentUser, profile, { editingCallerId = '' } = {}) {
  if (!currentUser?.uid) return { success: false, error: 'You must be signed in to save a report.' };
  if (!report?.branch?.trim()) return { success: false, error: 'Select a branch before saving this report.' };
  if (report?.reportType === COLLABORATED_REPORT_TYPE) return saveCollaboratedReport(report, currentUser, profile, editingCallerId);
  const dateKey = toDateKey(report?.reportDateKey);
  const reportId = createReportId(dateKey, currentUser.uid);
  const existingSnapshot = await getDoc(doc(db, REPORTS_COLLECTION, reportId));
  const now = Timestamp.now();
  const payload = {
    reportDateKey: dateKey,
    reportType: report?.reportType || DEFAULT_REPORT_TYPE,
    reportDate: Timestamp.fromDate(dateForStorage(dateKey)),
    ownerId: currentUser.uid,
    ownerName: currentUser.displayName || currentUser.email || profile?.displayName || 'Staff member',
    ownerEmail: currentUser.email || '',
    callerId: report?.callerId || currentUser.uid,
    callerName: report?.callerName || currentUser.displayName || currentUser.email || 'Caller',
    branch: report.branch.trim(),
    includeUncalledBirthdays: Boolean(report?.includeUncalledBirthdays && profile?.role === 'Admin' && profile?.status === 'approved'),
    birthdayClients: Array.isArray(report?.birthdayClients) ? report.birthdayClients.map(normalizeRow) : [],
    previousDayVisits: [...(Array.isArray(report?.previousDayVisits) ? report.previousDayVisits : []), ...(Array.isArray(report?.followUps) ? report.followUps : [])].map(normalizeRow),
    followUps: [],
    whatsappMessages: Array.isArray(report?.whatsappMessages) ? report.whatsappMessages.map(normalizeRow) : [],
    customColumns: Array.isArray(report?.customColumns) ? report.customColumns : [],
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

export async function deleteReport(reportId, currentUser, isAdmin = false) {
  if (!reportId || !currentUser?.uid) return { success: false, error: 'You must be signed in to delete a report.' };
  try {
    const reportRef = doc(db, REPORTS_COLLECTION, reportId);
    const reportSnapshot = await getDoc(reportRef);
    if (!reportSnapshot.exists()) return { success: false, error: 'Report not found.' };
    const ownerId = reportSnapshot.data()?.ownerId;
    if (!isAdmin && ownerId !== currentUser.uid) return { success: false, error: 'Only the report owner or an administrator can delete this report.' };
    await deleteDoc(reportRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting report:', error);
    return { success: false, error: error.message || 'Unable to delete report.' };
  }
}

export { toDateKey };
