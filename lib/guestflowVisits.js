import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentUser } from '@/lib/auth';

export function getKampalaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function authorizedRequest(url, options = {}) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('You must be signed in to manage check-ins.');
  const token = await currentUser.getIdToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The check-in request could not be completed.');
  return payload;
}

export async function getSpaIntakeGuestFlowVisitsForDate(date, branch = '') {
  const dateKey = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : getKampalaDateKey(typeof date === 'string' ? new Date(date) : date);
  const params = new URLSearchParams({ date: dateKey });
  if (branch) params.set('branch', branch);
  const payload = await authorizedRequest(`/api/guestflow/check-ins/fetch?${params.toString()}`);
  return payload.visits || [];
}

export async function checkInGuestFlowClient(clientId) {
  return authorizedRequest('/api/guestflow/check-ins', {
    method: 'POST',
    body: JSON.stringify({ clientId }),
  });
}

export async function deleteGuestFlowVisit(visitId) {
  return authorizedRequest(`/api/guestflow/check-ins/${encodeURIComponent(visitId)}`, {
    method: 'DELETE',
  });
}

export async function checkOutGuestFlowVisit(visitId, staffName = 'SpaGym staff', checkedOutAt = new Date()) {
  const ref = doc(db, 'guestflowVisits', visitId);
  const checkoutTimestamp = Timestamp.fromDate(new Date(checkedOutAt));
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists() || snapshot.data().checkedOutAt) return;
    transaction.update(ref, {
      checkedOutAt: checkoutTimestamp,
      checkedOutBy: String(staffName).slice(0, 120),
      updatedAt: Timestamp.now(),
    });
  });
}
