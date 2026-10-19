const FALLBACK_RESULT_THRESHOLD = 10;
const FALLBACK_READ_LIMIT = 200;
const RESULT_LIMIT = 100;

function normalizeText(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function digits(value = '') {
  return String(value).replace(/\D/g, '');
}

function phoneVariants(value = '') {
  const raw = digits(value);
  const variants = new Set(raw ? [raw] : []);
  if (/^256[789]\d{8}$/.test(raw)) variants.add(`0${raw.slice(3)}`);
  if (/^0[789]\d{8}$/.test(raw)) variants.add(`256${raw.slice(1)}`);
  return [...variants];
}

function nameTokens(value = '') {
  return [...new Set(normalizeText(value).split(' ').filter((token) => token.length >= 2))];
}

export function scoreClient(client, search, branch) {
  if (branch && String(client.branch || '').trim().toLowerCase() !== branch.trim().toLowerCase()) return -1;
  const queryText = normalizeText(search);
  const queryTokens = queryText.split(' ').filter(Boolean);
  const nameText = normalizeText(client.name);
  const branchText = normalizeText(client.branch);
  const phoneText = digits(client.phoneNumber);
  const queryDigits = phoneVariants(search);
  const nameMatches = queryTokens.length > 0 && queryTokens.every((token) => nameText.includes(token));
  const branchMatches = queryTokens.length > 0 && queryTokens.every((token) => branchText.includes(token));
  const phoneMatches = queryDigits.some((queryPhone) => queryPhone.length >= 3 && phoneText.includes(queryPhone));
  if (!nameMatches && !branchMatches && !phoneMatches) return -1;

  if (nameText === queryText) return 0;
  if (nameText.startsWith(queryText)) return 1;
  if (phoneMatches) return 2;
  if (nameMatches) return 3;
  return 4;
}

export function rankSearchResults(clients, search, branch, limit = RESULT_LIMIT) {
  return clients
    .map((client) => ({ client, score: scoreClient(client, search, branch) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => a.score - b.score || String(a.client.name || '').localeCompare(String(b.client.name || '')))
    .slice(0, limit)
    .map(({ client }) => client);
}

/**
 * Indexed Firestore queries that replace a full clients-collection read.
 * Each entry is bounded by limit. The recent fallback is separate so the
 * caller can skip it when the indexed queries already found enough people.
 */
export function buildIndexedSearchQueries(search, branch = null) {
  const searchTrimmed = String(search || '').trim();
  const queries = [];
  const seen = new Set();
  const add = (query) => {
    const key = JSON.stringify(query);
    if (seen.has(key)) return;
    seen.add(key);
    queries.push(query);
  };

  for (const phone of phoneVariants(searchTrimmed)) {
    if (phone.length < 3) continue;
    add({ field: 'phoneNumbers', op: 'array-contains', value: phone, limit: 10, branch });
    add({ field: 'phoneNumber', op: '==', value: phone, limit: 10, branch });
  }

  const searchLower = searchTrimmed.toLowerCase();
  const searchUpper = searchTrimmed.toUpperCase();
  const searchCapitalized = searchTrimmed.charAt(0).toUpperCase() + searchTrimmed.slice(1).toLowerCase();
  for (const name of [searchTrimmed, searchLower, searchUpper, searchCapitalized]) {
    if (!name) continue;
    add({ field: 'name', op: 'prefix', value: name, limit: 20, branch });
  }

  for (const token of nameTokens(searchTrimmed)) {
    add({ field: 'nameTokens', op: 'array-contains', value: token, limit: RESULT_LIMIT, branch });
  }

  return queries;
}

export function buildRecentFallbackQuery(branch = null) {
  return { field: 'createdAt', op: 'recent', limit: FALLBACK_READ_LIMIT, branch };
}

export function shouldUseRecentFallback(clients, search, branch) {
  if (clients.length >= FALLBACK_RESULT_THRESHOLD) return false;
  return !clients.some((client) => {
    const score = scoreClient(client, search, branch);
    return score >= 0 && score <= 2;
  });
}

export const CLIENT_SEARCH_RESULT_LIMIT = RESULT_LIMIT;
