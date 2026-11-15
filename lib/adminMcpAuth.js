import { Timestamp } from 'firebase-admin/firestore';
import { getServerFirestore } from './firebase-server.js';
import { takeRateLimitToken } from './clientDataContract.js';
import {
  ADMIN_MCP_SCOPE,
  TOP_ADMIN_EMAIL,
  authorizationRedirect,
  hashSecret,
  newSecret,
  pkceMatches,
  safeEqualHex,
  validateAuthorizeRequest,
  validateClientRegistration,
} from './adminMcp.js';

const CREDENTIAL_COLLECTION = 'adminMcp';
const CLIENTS = 'adminMcpClients';
const CODES = 'adminMcpCodes';
const TOKENS = 'adminMcpTokens';
const ACCESS_TTL_MS = 8 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 5 * 60 * 1000;
const registerBuckets = new Map();

export class OAuthError extends Error {
  constructor(error, description, status = 400) {
    super(description || error);
    this.oauthError = error;
    this.status = status;
  }
}

function expiresAt(now, ttl) {
  return Timestamp.fromMillis(now.getTime() + ttl);
}

function millis(value) {
  return value?.toMillis?.() || 0;
}

async function issueTokens(db, { clientId, email, uid, now }) {
  const access = newSecret('sgmcp_at_');
  const refresh = newSecret('sgmcp_rt_');
  const accessHash = hashSecret(access);
  const refreshHash = hashSecret(refresh);
  const base = { clientId, email, uid, scope: ADMIN_MCP_SCOPE };
  await Promise.all([
    db.collection(TOKENS).doc(accessHash).set({
      ...base,
      kind: 'access',
      hash: accessHash,
      expiresAt: expiresAt(now, ACCESS_TTL_MS),
      createdAt: Timestamp.fromDate(now),
    }),
    db.collection(TOKENS).doc(refreshHash).set({
      ...base,
      kind: 'refresh',
      hash: refreshHash,
      accessHash,
      expiresAt: expiresAt(now, REFRESH_TTL_MS),
      createdAt: Timestamp.fromDate(now),
    }),
  ]);
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_MS / 1000,
    refresh_token: refresh,
    scope: ADMIN_MCP_SCOPE,
  };
}

export function assertTopAdmin(access) {
  return Boolean(access?.ok && String(access.email || '').toLowerCase() === TOP_ADMIN_EMAIL);
}

export async function credentialStatus() {
  const snapshot = await getServerFirestore().collection(CREDENTIAL_COLLECTION).doc('credential').get();
  if (!snapshot.exists) return { configured: false };
  const data = snapshot.data();
  return {
    configured: Boolean(data.keyHash),
    keyPrefix: data.keyPrefix || '',
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
    lastUsedAt: data.lastUsedAt?.toDate?.()?.toISOString?.() || null,
  };
}

export async function mintCredential(actor, now = new Date()) {
  const token = newSecret('sgmcp_key_');
  const keyHash = hashSecret(token);
  await getServerFirestore().collection(CREDENTIAL_COLLECTION).doc('credential').set({
    keyHash,
    keyPrefix: token.slice(0, 16),
    createdAt: Timestamp.fromDate(now),
    createdBy: actor.uid,
    createdByEmail: actor.email,
    lastUsedAt: null,
  });
  return { token, keyPrefix: token.slice(0, 16), createdAt: now.toISOString() };
}

let credentialTouchedAt = 0;

async function touchCredential(now) {
  if (now.getTime() - credentialTouchedAt < 5 * 60 * 1000) return;
  try {
    await getServerFirestore().collection(CREDENTIAL_COLLECTION).doc('credential').set({
      lastUsedAt: Timestamp.fromDate(now),
    }, { merge: true });
    credentialTouchedAt = now.getTime();
  } catch (error) {
    console.error('Admin MCP could not record key use:', error?.code || error?.message);
  }
}

export async function verifyAdminMcpAccess(token, now = new Date()) {
  const presented = String(token || '');
  if (presented.length < 20 || presented.length > 200) return { ok: false };
  const hash = hashSecret(presented);
  const db = getServerFirestore();
  if (presented.startsWith('sgmcp_at_')) {
    const snapshot = await db.collection(TOKENS).doc(hash).get();
    if (!snapshot.exists) return { ok: false };
    const data = snapshot.data();
    if (data.kind !== 'access' || !safeEqualHex(data.hash, hash) || millis(data.expiresAt) <= now.getTime()) return { ok: false };
    if (String(data.email || '').toLowerCase() !== TOP_ADMIN_EMAIL) return { ok: false };
    return { ok: true, email: data.email, kind: 'oauth' };
  }
  if (!presented.startsWith('sgmcp_key_')) return { ok: false };
  const snapshot = await db.collection(CREDENTIAL_COLLECTION).doc('credential').get();
  if (!snapshot.exists) return { ok: false };
  const data = snapshot.data();
  if (!safeEqualHex(data.keyHash, hash)) return { ok: false };
  await touchCredential(now);
  return { ok: true, email: data.createdByEmail || TOP_ADMIN_EMAIL, kind: 'key' };
}

export async function registerOAuthClient(body, { ip = '', now = new Date() } = {}) {
  const quota = takeRateLimitToken(registerBuckets, `register:${ip || 'unknown'}`, now.getTime(), 20, 10 * 60 * 1000);
  if (!quota.allowed) throw new OAuthError('temporarily_unavailable', 'Too many registration attempts. Try again shortly.', 429);
  const validated = validateClientRegistration(body);
  if (!validated.ok) throw new OAuthError(validated.error, validated.description);
  const db = getServerFirestore();
  const existing = await db.collection(CLIENTS).orderBy('createdAt', 'asc').get();
  if (existing.size >= 30) {
    await Promise.all(existing.docs.slice(0, existing.size - 20).map((client) => client.ref.delete()));
  }
  const clientId = newSecret('sgmcp_client_');
  const record = {
    clientName: validated.client.clientName,
    redirectUris: validated.client.redirectUris,
    createdAt: Timestamp.fromDate(now),
  };
  await db.collection(CLIENTS).doc(clientId).set(record);
  return {
    client_id: clientId,
    client_name: record.clientName,
    redirect_uris: record.redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: ADMIN_MCP_SCOPE,
  };
}

async function registeredClient(clientId) {
  const id = String(clientId || '');
  if (!id.startsWith('sgmcp_client_') || id.length > 180) return null;
  const snapshot = await getServerFirestore().collection(CLIENTS).doc(id).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  return { clientId: id, clientName: data.clientName || 'Grok', redirectUris: data.redirectUris || [] };
}

export async function beginAuthorization(params) {
  const client = await registeredClient(params.client_id || params.clientId);
  return { client, decision: validateAuthorizeRequest(params, client) };
}

export async function approveAuthorization(actor, params, now = new Date()) {
  if (String(actor.email || '').toLowerCase() !== TOP_ADMIN_EMAIL) {
    throw new OAuthError('access_denied', 'Only the top administrator can connect this MCP.', 403);
  }
  const client = await registeredClient(params.clientId || params.client_id);
  const decision = validateAuthorizeRequest(params, client);
  if (!decision.ok) throw new OAuthError(decision.error, decision.description);
  const code = newSecret('sgmcp_code_');
  const request = decision.request;
  await getServerFirestore().collection(CODES).doc(hashSecret(code)).set({
    ...request,
    hash: hashSecret(code),
    email: actor.email,
    uid: actor.uid,
    expiresAt: expiresAt(now, CODE_TTL_MS),
    createdAt: Timestamp.fromDate(now),
  });
  return { redirectTo: authorizationRedirect(request.redirectUri, { code, state: request.state }) };
}

export async function exchangeAuthorizationCode(params, now = new Date()) {
  const code = String(params.code || '');
  const clientId = String(params.client_id || '');
  const redirectUri = String(params.redirect_uri || '');
  const verifier = String(params.code_verifier || '');
  if (!code.startsWith('sgmcp_code_') || !clientId || !redirectUri || !verifier) {
    throw new OAuthError('invalid_grant', 'The authorization code is invalid.');
  }
  const db = getServerFirestore();
  const ref = db.collection(CODES).doc(hashSecret(code));
  const consumed = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new OAuthError('invalid_grant', 'The authorization code is invalid or has already been used.');
    const data = snapshot.data();
    transaction.delete(ref);
    if (!safeEqualHex(data.hash, hashSecret(code)) || millis(data.expiresAt) <= now.getTime()) {
      throw new OAuthError('invalid_grant', 'The authorization code has expired.');
    }
    if (data.clientId !== clientId || data.redirectUri !== redirectUri || !pkceMatches(verifier, data.codeChallenge)) {
      throw new OAuthError('invalid_grant', 'The authorization code does not match this client.');
    }
    return data;
  });
  return issueTokens(db, { clientId: consumed.clientId, email: consumed.email, uid: consumed.uid, now });
}

export async function exchangeRefreshToken(params, now = new Date()) {
  const refresh = String(params.refresh_token || '');
  const clientId = String(params.client_id || '');
  if (!refresh.startsWith('sgmcp_rt_') || !clientId) throw new OAuthError('invalid_grant', 'The refresh token is invalid.');
  const db = getServerFirestore();
  const hash = hashSecret(refresh);
  const ref = db.collection(TOKENS).doc(hash);
  const current = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new OAuthError('invalid_grant', 'The refresh token is invalid.');
    const data = snapshot.data();
    transaction.delete(ref);
    if (data.accessHash) transaction.delete(db.collection(TOKENS).doc(data.accessHash));
    if (data.kind !== 'refresh' || !safeEqualHex(data.hash, hash) || data.clientId !== clientId || millis(data.expiresAt) <= now.getTime()) {
      throw new OAuthError('invalid_grant', 'The refresh token has expired.');
    }
    if (String(data.email || '').toLowerCase() !== TOP_ADMIN_EMAIL) throw new OAuthError('access_denied', 'Only the top administrator can use this MCP.', 403);
    return data;
  });
  return issueTokens(db, { clientId: current.clientId, email: current.email, uid: current.uid, now });
}
