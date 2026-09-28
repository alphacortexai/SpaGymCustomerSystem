import { collection, getDocs, query, Timestamp, updateDoc, where, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function getKampalaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function getTodayGuestFlowVisits() {
  const snapshot = await getDocs(query(
    collection(db, 'guestflowVisits'),
    where('visitDate', '==', getKampalaDateKey()),
  ));
  const visits = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  visits.sort((a, b) => {
    const first = a.checkedInAt?.toMillis?.() || 0;
    const second = b.checkedInAt?.toMillis?.() || 0;
    return second - first;
  });
  return visits;
}

export async function checkOutGuestFlowVisit(visitId, staffName = 'SpaGym staff') {
  await updateDoc(doc(db, 'guestflowVisits', visitId), {
    checkedOutAt: Timestamp.now(),
    checkedOutBy: String(staffName).slice(0, 120),
    updatedAt: Timestamp.now(),
  });
}
