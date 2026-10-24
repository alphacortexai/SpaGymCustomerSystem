import { Timestamp } from 'firebase-admin/firestore';
import { getServerFirestore } from '@/lib/firebase-server';
import { deliverCheckInAlert } from '@/lib/spaSysWebhook';
import { noteSpaSysWebhook, webhookAttempt, webhookHost } from '@/lib/spaSysActivityStore';
import {
  assertIntegrationId,
  createIntegrationSecrets,
  hashSpaSysKey,
  publicIntegration,
  validateIntegrationName,
  validateWebhookUrl,
} from '@/lib/spaSysIntegrationModel';

const COLLECTION = 'spaSysIntegrations';

function collection() {
  return getServerFirestore().collection(COLLECTION);
}

export async function listSpaSysIntegrations() {
  const snapshot = await collection().limit(50).get();
  return snapshot.docs
    .map((item) => publicIntegration(item.id, item.data()))
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
}

export async function findActiveIntegrationByKey(apiKey) {
  const key = String(apiKey || '');
  if (key.length < 32 || key.length > 256) return null;
  const snapshot = await collection().where('keyHash', '==', hashSpaSysKey(key)).limit(1).get();
  if (snapshot.empty) return null;
  const item = snapshot.docs[0];
  const data = item.data();
  if (data.status === 'revoked') return null;
  item.ref.update({ lastUsedAt: Timestamp.now() }).catch((error) => {
    console.error('SPA_SYS_API_V1 could not record API use:', error?.message || 'Unknown error');
  });
  return {
    id: item.id,
    name: String(data.name || ''),
    keyPreview: String(data.keyPreview || ''),
  };
}

function storedView(id, data) {
  return publicIntegration(id, data);
}

async function loadIntegration(id) {
  const integrationId = assertIntegrationId(id);
  if (!integrationId) return { error: 'Unknown registration.', status: 404 };
  const snapshot = await collection().doc(integrationId).get();
  if (!snapshot.exists) return { error: 'Unknown registration.', status: 404 };
  return { id: integrationId, ref: snapshot.ref, data: snapshot.data() };
}

export async function createSpaSysIntegration({ name, webhookUrl, createdBy, createdByName }) {
  const named = validateIntegrationName(name);
  if (named.error) return { error: named.error, status: 400 };
  const webhook = validateWebhookUrl(webhookUrl);
  if (webhook.error) return { error: webhook.error, status: 400 };
  const existing = await collection().limit(50).get();
  if (existing.size >= 50) {
    return { error: 'This SpaGym already has 50 API registrations. Delete one before adding another.', status: 400 };
  }
  const secrets = createIntegrationSecrets();
  const now = Timestamp.now();
  const ref = collection().doc();
  const data = {
    name: named.name,
    status: 'active',
    keyHash: hashSpaSysKey(secrets.apiKey),
    keyPreview: secrets.apiKey.slice(0, 8),
    webhookUrl: webhook.webhookUrl,
    webhookSecret: secrets.webhookSecret,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    createdBy: String(createdBy || ''),
    createdByName: String(createdByName || 'Admin').slice(0, 120),
  };
  await ref.set(data);
  return {
    integration: storedView(ref.id, data),
    apiKey: secrets.apiKey,
    webhookSecret: secrets.webhookSecret,
  };
}

export async function updateSpaSysIntegration(id, patch = {}) {
  const loaded = await loadIntegration(id);
  if (loaded.error) return loaded;
  const next = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
    const named = validateIntegrationName(patch.name);
    if (named.error) return { error: named.error, status: 400 };
    next.name = named.name;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'webhookUrl')) {
    const webhook = validateWebhookUrl(patch.webhookUrl);
    if (webhook.error) return { error: webhook.error, status: 400 };
    next.webhookUrl = webhook.webhookUrl;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    if (patch.status !== 'active' && patch.status !== 'revoked') {
      return { error: 'Status must be active or revoked.', status: 400 };
    }
    next.status = patch.status;
  }
  if (!Object.keys(next).length) return { error: 'Nothing to update.', status: 400 };
  next.updatedAt = Timestamp.now();
  await loaded.ref.update(next);
  return { integration: storedView(loaded.id, { ...loaded.data, ...next }) };
}

export async function rotateSpaSysCredential(id, credential) {
  const loaded = await loadIntegration(id);
  if (loaded.error) return loaded;
  if (credential !== 'apiKey' && credential !== 'webhookSecret') {
    return { error: 'Choose the API key or the webhook secret to replace.', status: 400 };
  }
  const secrets = createIntegrationSecrets();
  const next = { updatedAt: Timestamp.now() };
  const revealed = {};
  if (credential === 'apiKey') {
    next.keyHash = hashSpaSysKey(secrets.apiKey);
    next.keyPreview = secrets.apiKey.slice(0, 8);
    revealed.apiKey = secrets.apiKey;
  } else {
    next.webhookSecret = secrets.webhookSecret;
    revealed.webhookSecret = secrets.webhookSecret;
  }
  await loaded.ref.update(next);
  return { integration: storedView(loaded.id, { ...loaded.data, ...next }), ...revealed };
}

export async function deleteSpaSysIntegration(id) {
  const loaded = await loadIntegration(id);
  if (loaded.error) return loaded;
  await loaded.ref.delete();
  return { deleted: true, id: loaded.id };
}

export async function deliverAllCheckInAlerts(payload) {
  const targets = [];
  if (process.env.SPA_SYS_WEBHOOK_URL && process.env.SPA_SYS_WEBHOOK_SECRET) {
    targets.push({
      url: process.env.SPA_SYS_WEBHOOK_URL,
      secret: process.env.SPA_SYS_WEBHOOK_SECRET,
      subjectId: 'env',
      name: 'Environment webhook',
    });
  }
  try {
    const snapshot = await collection().where('status', '==', 'active').limit(50).get();
    snapshot.docs.forEach((item) => {
      const data = item.data();
      if (data.webhookUrl && data.webhookSecret) {
        targets.push({
          url: data.webhookUrl,
          secret: data.webhookSecret,
          subjectId: item.id,
          name: String(data.name || 'Webhook'),
        });
      }
    });
  } catch (error) {
    console.error('SPA_SYS_API_V1 could not load webhook registrations:', error?.message || 'Unknown error');
  }
  for (const target of targets) {
    let attempt = webhookAttempt(null, new Error('network'));
    try {
      const result = await deliverCheckInAlert({
        payload,
        env: { SPA_SYS_WEBHOOK_URL: target.url, SPA_SYS_WEBHOOK_SECRET: target.secret, NODE_ENV: process.env.NODE_ENV },
      });
      attempt = webhookAttempt(result);
      if (!result.delivered && result.reason && result.reason !== 'not_configured') {
        console.error('SPA_SYS_API_V1 check-in alert was not delivered:', result.reason);
      }
    } catch (error) {
      attempt = webhookAttempt(null, error);
      console.error('SPA_SYS_API_V1 check-in alert failed:', error?.message || 'Unknown error');
    }
    if (attempt.reason === 'not_configured') continue;
    noteSpaSysWebhook({
      subjectId: target.subjectId,
      name: target.name,
      host: webhookHost(target.url),
      ...attempt,
    });
  }
}
