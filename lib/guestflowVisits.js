import { collection, doc, getDocs, query, runTransaction, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentUser } from '@/lib/auth';

const AUTO_CHECKOUT_AFTER_MS = 12 * 60 * 60 * 1000;

export function getKampalaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function getTodayGuestFlowVisits({ canCheckOut = false } = {}) {
  const snapshot = await getDocs(query(
    collection(db, 'guestflowVisits'),
    where('visitDate', '==', getKampalaDateKey()),
  ));
  const now = Date.now();
  const visits = await Promise.all(snapshot.docs.map(async (item) => {
    const visit = { id: item.id, ...item.data() };
    const checkedInAt = visit.checkedInAt?.toMillis?.() || 0;
    if (visit.checkedOutAt || !checkedInAt || now - checkedInAt < AUTO_CHECKOUT_AFTER_MS) return visit;

    const automaticCheckout = new Date(checkedInAt + AUTO_CHECKOUT_AFTER_MS);
    if (canCheckOut) {
      await checkOutGuestFlowVisit(visit.id, 'Automatic (12-hour timeout)', automaticCheckout);
    }
    return {
      ...visit,
      checkedOutAt: Timestamp.fromDate(automaticCheckout),
      checkedOutBy: 'Automatic (12-hour timeout)',
    };
  }));
  visits.sort((a, b) => {
    const first = a.checkedInAt?.toMillis?.() || 0;
    const second = b.checkedInAt?.toMillis?.() || 0;
    return second - first;
  });
  return visits;
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
