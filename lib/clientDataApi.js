import { ApiError, AUTO_CHECKOUT_AFTER_MS, listBranches, searchClients } from '@/lib/guestflowApi';
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
