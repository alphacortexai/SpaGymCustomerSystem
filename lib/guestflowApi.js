import { timingSafeEqual } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { getServerFirestore } from '@/lib/firebase-server';
import { normalizePhoneNumberWithAll } from '@/lib/phoneUtils';

const VISITS_COLLECTION = 'guestflowVisits';
const VISIT_LOCKS_COLLECTION = 'guestflowVisitLocks';
const AUTO_CHECKOUT_AFTER_MS = 12 * 60 * 60 * 1000;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function isAuthorizedGuestFlowRequest(request) {
  const expected = process.env.GUESTFLOW_API_KEY;
  if (!expected) return false;
  const authorization = request.headers.get('authorization') || '';
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function dateKeyInKampala(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function asIso(value) {
  if (!value) return null;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePhoneInput(value) {
  const phone = String(value || '').trim();
  // GuestFlow accepts international numbers entered with the 00 access prefix.
  // Convert that prefix to + before normalizing so save and lookup share one canonical value.
  const normalizedInput = phone.replace(/^\s*00(?=\s*\d)/, '+');
  const normalized = normalizePhoneNumberWithAll(normalizedInput).validNumbers;
  if (normalized.length === 0) {
    const digits = normalizedInput.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) throw new ApiError(400, 'Enter a valid phone number.');
    return [digits];
  }
  return [...new Set(normalized)];
}

function normalizeStoredPhoneNumbers(value) {
  const phone = String(value || '').trim();
  const normalizedInput = phone.replace(/^\s*00(?=\s*\d)/, '+');
  const normalized = normalizePhoneNumberWithAll(normalizedInput).validNumbers;
  if (normalized.length) return [...new Set(normalized)];
  const digits = normalizedInput.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? [digits] : [];
}

function monthNumber(value) {
  if (typeof value === 'number' || /^\d{1,2}$/.test(String(value || ''))) {
    const result = Number(value);
    return result >= 1 && result <= 12 ? result : null;
  }
  const index = MONTHS.findIndex((month) => month.toLowerCase() === String(value || '').trim().toLowerCase());
  return index < 0 ? null : index + 1;
}

function serializeClient(id, data = {}) {
  const birthMonth = Number(data.birthMonth) || null;
  const birthDay = Number(data.birthDay) || null;
  return {
    id,
    name: String(data.name || ''),
    phoneNumber: String(data.phoneNumber || ''),
    phone: String(data.phoneNumber || ''),
    birthMonth,
    birthDay,
    month: birthMonth ? MONTHS[birthMonth - 1] : '',
    day: birthDay ? String(birthDay) : '',
    branch: String(data.branch || ''),
    registeredBranch: String(data.branch || ''),
    createdAt: asIso(data.createdAt),
  };
}

function serializeVisit(id, data = {}) {
  return {
    id,
    clientId: data.clientId,
    clientName: data.clientName || '',
    clientCreatedAt: asIso(data.clientCreatedAt),
    name: data.clientName || '',
    phoneNumber: data.phoneNumber || '',
    phone: data.phoneNumber || '',
    birthMonth: data.birthMonth || null,
    birthDay: data.birthDay || null,
    branch: data.checkedInBranch || data.branch || '',
    checkedInBranch: data.checkedInBranch || data.branch || '',
    registeredBranch: data.registeredBranch || '',
    visitDate: data.visitDate,
    checkedInAt: asIso(data.checkedInAt),
    checkedOutAt: asIso(data.checkedOutAt),
    checkedOutBy: data.checkedOutBy || '',
    source: data.source || 'GuestFlow',
  };
}

async function findClient(phoneNumbers) {
  const snapshot = await getServerFirestore().collection('clients').get();
  for (const item of snapshot.docs) {
    const storedNumbers = normalizeStoredPhoneNumbers(item.data().phoneNumber || '');
    if (storedNumbers.some((stored) => phoneNumbers.includes(stored))) {
      return { ref: item.ref, id: item.id, data: item.data() };
    }
  }
  return null;
}

export async function listBranches() {
  const snapshot = await getServerFirestore().collection('branches').get();
  return snapshot.docs
    .map((item) => ({ id: item.id, name: String(item.data().name || '').trim() }))
    .filter((branch) => branch.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function resolveBranchName(branchIdOrName) {
  const value = String(branchIdOrName || '').trim();
  if (!value) return '';
  if (value.length > 180) throw new ApiError(400, 'Invalid branch selection.');
  const branches = await listBranches();
  const match = branches.find((branch) => branch.id === value || branch.name.toLowerCase() === value.toLowerCase());
  if (!match) throw new ApiError(400, 'The selected SpaGym branch no longer exists. Refresh and choose a current branch.');
  return match.name;
}

export async function lookupClient(phone) {
  const numbers = normalizePhoneInput(phone);
  const found = await findClient(numbers);
  return found ? serializeClient(found.id, found.data) : null;
}

export async function searchClients({ search = '', phone = '', limit = 50 } = {}) {
  const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const snapshot = await getServerFirestore().collection('clients').get();
  let phoneNumbers = [];
  if (phone) phoneNumbers = normalizePhoneInput(phone);
  const term = String(search || '').trim().toLowerCase();
  const matches = snapshot.docs.filter((item) => {
    const data = item.data();
    if (phoneNumbers.length) return normalizeStoredPhoneNumbers(data.phoneNumber || '').some((stored) => phoneNumbers.includes(stored));
    if (!term) return false;
    return String(data.name || '').toLowerCase().includes(term)
      || String(data.phoneNumber || '').toLowerCase().includes(term);
  });
  return matches.slice(0, pageSize).map((item) => serializeClient(item.id, item.data()));
}

export async function createClient(input) {
  const name = String(input?.name || '').trim();
  if (name.length < 2 || name.length > 120) throw new ApiError(400, 'Name must be between 2 and 120 characters.');
  const phones = normalizePhoneInput(input?.phoneNumber || input?.phone);
  const existing = await findClient(phones);
  if (existing) return { client: serializeClient(existing.id, existing.data), created: false };

  const birthDay = Number(input?.birthDay || input?.day);
  const birthMonth = monthNumber(input?.birthMonth || input?.month);
  const validDay = Number.isInteger(birthDay) && birthMonth
    && new Date(Date.UTC(2000, birthMonth - 1, birthDay)).getUTCMonth() === birthMonth - 1
    && new Date(Date.UTC(2000, birthMonth - 1, birthDay)).getUTCDate() === birthDay;
  if (!validDay) {
    throw new ApiError(400, 'A valid birthday month and day are required.');
  }
  const phoneNumber = phones.join(', ');
  const selectedBranch = await resolveBranchName(input?.branchId || input?.branch);
  const now = Timestamp.now();
  const data = {
    name,
    phoneNumber,
    branch: selectedBranch || String(process.env.GUESTFLOW_DEFAULT_BRANCH || '').trim(),
    birthMonth,
    birthDay,
    createdAt: now,
    updatedAt: now,
    source: 'GuestFlow',
  };
  const ref = await getServerFirestore().collection('clients').add(data);
  return { client: serializeClient(ref.id, data), created: true };
}

export async function recordCheckIn(phone, clientId = '', branchId = '') {
  let client = null;
  if (clientId) {
    const id = String(clientId).trim();
    if (id.length > 180 || id.includes('/')) throw new ApiError(400, 'Invalid client record id.');
    const ref = getServerFirestore().collection('clients').doc(id);
    const snapshot = await ref.get();
    if (snapshot.exists) client = { ref, id: snapshot.id, data: snapshot.data() };
  } else {
    const numbers = normalizePhoneInput(phone);
    client = await findClient(numbers);
  }
  if (!client) {
    const message = clientId ? 'No client record matches that id.' : 'No client record matches that phone number.';
    throw new ApiError(404, message, { code: 'CLIENT_NOT_FOUND' });
  }
  const selectedBranch = await resolveBranchName(branchId);
  const visitBranch = selectedBranch || String(client.data.branch || '').trim();

  const db = getServerFirestore();
  const visitDate = dateKeyInKampala();
  const lockRef = db.collection(VISIT_LOCKS_COLLECTION).doc(`${client.id}_${visitDate}`);
  const legacyVisitRef = db.collection(VISITS_COLLECTION).doc(`${client.id}_${visitDate}`);
  const visitRef = db.collection(VISITS_COLLECTION).doc();
  const now = Timestamp.now();
  let alreadyCheckedIn = false;
  let visitId;
  let visitData;
  await db.runTransaction(async (transaction) => {
    alreadyCheckedIn = false;
    visitData = undefined;
    visitId = undefined;
    const lockSnapshot = await transaction.get(lockRef);
    const activeVisitRef = lockSnapshot.exists && lockSnapshot.data().visitId
      ? db.collection(VISITS_COLLECTION).doc(lockSnapshot.data().visitId)
      : legacyVisitRef;
    const activeVisitSnapshot = await transaction.get(activeVisitRef);
    if (activeVisitSnapshot.exists) {
      const activeVisit = activeVisitSnapshot.data();
      if (!activeVisit.checkedOutAt) {
        const checkedInAtMs = activeVisit.checkedInAt?.toMillis?.() || 0;
        if (checkedInAtMs && now.toMillis() < checkedInAtMs + AUTO_CHECKOUT_AFTER_MS) {
          alreadyCheckedIn = true;
          visitId = activeVisitSnapshot.id;
          visitData = activeVisit;
          return;
        }
        const autoCheckedOutAt = Timestamp.fromMillis(
          checkedInAtMs ? checkedInAtMs + AUTO_CHECKOUT_AFTER_MS : now.toMillis(),
        );
        transaction.update(activeVisitRef, {
          checkedOutAt: autoCheckedOutAt,
          checkedOutBy: 'Automatic (12-hour timeout)',
          updatedAt: now,
        });
      }
    }
    visitData = {
      clientId: client.id,
      clientName: client.data.name || '',
      clientCreatedAt: client.data.createdAt || null,
      phoneNumber: client.data.phoneNumber || '',
      birthMonth: client.data.birthMonth || null,
      birthDay: client.data.birthDay || null,
      branch: visitBranch,
      checkedInBranch: visitBranch,
      registeredBranch: String(client.data.branch || '').trim(),
      visitDate,
      checkedInAt: now,
      checkedOutAt: null,
      checkedOutBy: '',
      source: 'GuestFlow',
    };
    transaction.create(visitRef, visitData);
    transaction.set(lockRef, { clientId: client.id, visitId: visitRef.id, visitDate, updatedAt: now });
    visitId = visitRef.id;
  });
  return {
    client: serializeClient(client.id, client.data),
    visit: serializeVisit(visitId, visitData),
    alreadyCheckedIn,
  };
}

async function closeExpiredVisits(db) {
  const openVisits = await db.collection(VISITS_COLLECTION).where('checkedOutAt', '==', null).get();
  const now = Date.now();
  const expired = openVisits.docs.filter((item) => {
    const checkedInAt = item.data().checkedInAt?.toMillis?.() || 0;
    return checkedInAt && now - checkedInAt >= AUTO_CHECKOUT_AFTER_MS;
  });
  await Promise.all(expired.map((item) => db.runTransaction(async (transaction) => {
    const current = await transaction.get(item.ref);
    if (!current.exists) return;
    const data = current.data();
    if (data.checkedOutAt) return;
    const checkedInAt = data.checkedInAt?.toMillis?.() || 0;
    const observedAt = Date.now();
    if (!checkedInAt || observedAt - checkedInAt < AUTO_CHECKOUT_AFTER_MS) return;
    transaction.update(item.ref, {
      checkedOutAt: Timestamp.fromMillis(checkedInAt + AUTO_CHECKOUT_AFTER_MS),
      checkedOutBy: 'Automatic (12-hour timeout)',
      updatedAt: Timestamp.now(),
    });
  })));
}

export async function listCheckIns(date = dateKeyInKampala(), branchId = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'Date must use YYYY-MM-DD format.');
  const db = getServerFirestore();
  const branchName = await resolveBranchName(branchId);
  await closeExpiredVisits(db);
  const snapshot = await db.collection(VISITS_COLLECTION).where('visitDate', '==', date).get();
  return snapshot.docs
    .map((item) => serializeVisit(item.id, item.data()))
    .filter((visit) => !branchName || visit.branch === branchName)
    .sort((a, b) => String(b.checkedInAt || '').localeCompare(String(a.checkedInAt || '')));
}

export async function recordCheckOut(visitId, staffName = 'GuestFlow') {
  if (!visitId || visitId.length > 180 || visitId.includes('/')) throw new ApiError(400, 'Invalid check-in id.');
  const ref = getServerFirestore().collection(VISITS_COLLECTION).doc(visitId);
  let result;
  await getServerFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new ApiError(404, 'Check-in record was not found.');
    const data = snapshot.data();
    if (!data.checkedOutAt) {
      data.checkedOutAt = Timestamp.now();
      data.checkedOutBy = String(staffName || 'GuestFlow').slice(0, 120);
      transaction.update(ref, {
        checkedOutAt: data.checkedOutAt,
        checkedOutBy: data.checkedOutBy,
        updatedAt: Timestamp.now(),
      });
    }
    result = serializeVisit(snapshot.id, data);
  });
  return result;
}

export async function getSummary(branchId = '') {
  const db = getServerFirestore();
  const today = dateKeyInKampala();
  const branchName = await resolveBranchName(branchId);
  const clientCountQuery = branchName
    ? db.collection('clients').where('branch', '==', branchName)
    : db.collection('clients');
  const [clientCountSnapshot, checkIns] = await Promise.all([
    clientCountQuery.count().get(),
    listCheckIns(today, branchId),
  ]);
  return {
    clientCount: clientCountSnapshot.data().count,
    visitCount: checkIns.length,
    visits: checkIns.slice(0, 100),
    date: today,
  };
}

export class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
