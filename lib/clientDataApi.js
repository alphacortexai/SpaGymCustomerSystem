import { Timestamp } from 'firebase-admin/firestore';
import { ApiError, AUTO_CHECKOUT_AFTER_MS, listBranches, recordCheckOut, searchClients } from '@/lib/guestflowApi';
import { clientIndexFields, clientNameTokens } from '@/lib/clientSearch';
import { getServerFirestore } from '@/lib/firebase-server';
import { extractAllPhoneNumbers } from '@/lib/phoneUtils';
import {
  CLIENT_DATA_CHECK_IN_LIMIT,
  ContractError,
  assertClientId,
  parseResultLimit,
  serializeCheckIn,
  serializeClientProfile,
  visitMatchesPhone,
} from '@/lib/clientDataContract';

function asApiError(error) {
  if (error instanceof ApiError) return error;
  if (error instanceof ContractError) return new ApiError(error.status, error.message);
  return error;
}

async function profilesForMatches(matches) {
  if (!matches.length) return [];
  const db = getServerFirestore();
  const snapshots = await db.getAll(...matches.map((match) => db.collection('clients').doc(match.id)));
  const profiles = new Map();
  snapshots.forEach((snapshot) => {
    if (snapshot.exists) profiles.set(snapshot.id, serializeClientProfile(snapshot.id, snapshot.data()));
  });
  return matches.map((match) => profiles.get(match.id)).filter(Boolean);
}

export async function queryClientProfiles({ phone = '', search = '', limit = 20 } = {}) {
  try {
    const pageSize = parseResultLimit(limit, { fallback: 20, max: 50 });
    const phoneText = String(phone || '').trim();
    const term = String(search || '').trim();
    if (phoneText && term) throw new ApiError(400, 'Provide either phone or search, not both.');
    if (!phoneText && term.length < 2) throw new ApiError(400, 'Provide a phone number or at least two characters of a name.');
    if (term.length > 80 || [...term].some((character) => character.charCodeAt(0) < 32)) {
      throw new ApiError(400, 'Search text is invalid.');
    }
    const matches = await searchClients({ phone: phoneText, search: term, limit: pageSize });
    return profilesForMatches(matches);
  } catch (error) {
    throw asApiError(error);
  }
}

export async function getClientProfile(clientId) {
  try {
    const id = assertClientId(clientId);
    const snapshot = await getServerFirestore().collection('clients').doc(id).get();
    return snapshot.exists ? serializeClientProfile(snapshot.id, snapshot.data()) : null;
  } catch (error) {
    throw asApiError(error);
  }
}

async function canonicalBranchName(branch) {
  const value = String(branch || '').trim();
  if (!value) return '';
  if (value.length > 180) throw new ApiError(400, 'Unknown branch.');
  const branches = await listBranches();
  const match = branches.find((item) => item.id === value || item.name.toLowerCase() === value.toLowerCase());
  if (!match) throw new ApiError(400, 'Unknown branch.');
  return match.name;
}

export async function updateClientProfile(clientId, changes) {
  const id = assertClientId(clientId);
  const ref = getServerFirestore().collection('clients').doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  if (changes.phoneNumber) {
    const matches = await queryClientProfiles({ phone: changes.phoneNumber, limit: 10 });
    if (matches.some((client) => client.id !== id)) {
      throw new ApiError(409, 'Another client already uses that phone number.', { code: 'PHONE_IN_USE' });
    }
  }
  const current = snapshot.data();
  const update = { updatedAt: Timestamp.now() };
  if (changes.name) {
    update.name = changes.name;
    update.nameTokens = clientNameTokens(changes.name);
  }
  if (changes.phoneNumber) {
    update.phoneNumber = changes.phoneNumber;
    update.phoneNumbers = changes.phoneNumbers;
  }
  if (changes.clearDateOfBirth) {
    update.dateOfBirth = null;
    update.birthMonth = null;
    update.birthDay = null;
  } else if (changes.birthMonth) {
    const year = new Date().getFullYear();
    update.birthMonth = changes.birthMonth;
    update.birthDay = changes.birthDay;
    update.dateOfBirth = Timestamp.fromDate(new Date(year, changes.birthMonth - 1, changes.birthDay));
  }
  const indexed = clientIndexFields({ ...current, ...update });
  update.nameTokens = indexed.nameTokens;
  if (indexed.phoneNumbers.length) update.phoneNumbers = indexed.phoneNumbers;
  await ref.update(update);
  if (changes.name) {
    try {
      const enrollments = await getServerFirestore().collection('enrollments').where('clientId', '==', id).get();
      await Promise.all(enrollments.docs.map((item) => item.ref.update({ clientName: changes.name })));
    } catch (error) {
      console.error('SPA_SYS_API_V1 enrollment name update failed:', error?.message || 'Unknown error');
    }
  }
  const fresh = await ref.get();
  return serializeClientProfile(fresh.id, fresh.data());
}

async function openVisitId(clientId) {
  const snapshot = await getServerFirestore().collection('guestflowVisits').where('clientId', '==', clientId).get();
  const open = snapshot.docs.filter((item) => !item.data().checkedOutAt);
  open.sort((left, right) => (right.data().checkedInAt?.toMillis?.() || 0) - (left.data().checkedInAt?.toMillis?.() || 0));
  return open[0]?.id || '';
}

export async function checkOutClient({ visitId = '', phone = '', clientId = '', staffName = 'SPA_SYS_API_V1' } = {}) {
  const actor = [...String(staffName || 'SPA_SYS_API_V1')].filter((character) => character.charCodeAt(0) >= 32).join('').trim().slice(0, 120) || 'SPA_SYS_API_V1';
  let targetVisitId = String(visitId || '').trim();
  if (!targetVisitId) {
    let id = clientId ? assertClientId(clientId) : '';
    if (!id && phone) {
      const matches = await queryClientProfiles({ phone, limit: 10 });
      if (!matches.length) throw new ApiError(404, 'No client record matches that phone number.', { code: 'CLIENT_NOT_FOUND' });
      if (matches.length > 1) {
        throw new ApiError(409, 'More than one client has that phone number. Check out by client id or visit id.', { code: 'AMBIGUOUS_CLIENT' });
      }
      id = matches[0].id;
    }
    if (!id) throw new ApiError(400, 'Provide a visit id, client id, or phone number.');
    targetVisitId = await openVisitId(id);
    if (!targetVisitId) throw new ApiError(404, 'That client has no open check-in.', { code: 'CHECK_IN_NOT_FOUND' });
  }
  const closed = await recordCheckOut(targetVisitId, actor);
  const snapshot = await getServerFirestore().collection('guestflowVisits').doc(closed.id).get();
  return snapshot.exists ? serializeCheckIn(snapshot.id, snapshot.data()) : closed;
}

export async function queryVisitRegister({
  dates,
  branch = '',
  clientId = '',
  phone = '',
  now = new Date(),
} = {}) {
  const branchName = await canonicalBranchName(branch);
  const id = clientId ? assertClientId(clientId) : '';
  if (id) {
    const profile = await getClientProfile(id);
    if (!profile) throw new ApiError(404, 'No client record matches that id.', { code: 'CLIENT_NOT_FOUND' });
  }
  const phoneText = String(phone || '').trim();
  const wantedPhones = phoneText ? extractAllPhoneNumbers(phoneText) : [];
  if (phoneText && wantedPhones.length === 0) throw new ApiError(400, 'Enter a valid phone number.');

  const db = getServerFirestore();
  const snapshots = await Promise.all(
    dates.map((date) => db.collection('guestflowVisits').where('visitDate', '==', date).get()),
  );
  let visits = snapshots.flatMap((snapshot) => snapshot.docs.map((item) => serializeCheckIn(item.id, item.data(), now, AUTO_CHECKOUT_AFTER_MS)));
  if (branchName) visits = visits.filter((visit) => visit.branch === branchName);
  if (id) visits = visits.filter((visit) => visit.clientId === id);
  if (wantedPhones.length) visits = visits.filter((visit) => visitMatchesPhone(visit.phoneNumber, wantedPhones));
  visits.sort((left, right) => String(right.checkedInAt || '').localeCompare(String(left.checkedInAt || '')) || left.id.localeCompare(right.id));
  return {
    branch: branchName || null,
    matched: visits.length,
    truncated: visits.length > CLIENT_DATA_CHECK_IN_LIMIT,
    checkIns: visits.slice(0, CLIENT_DATA_CHECK_IN_LIMIT),
  };
}
