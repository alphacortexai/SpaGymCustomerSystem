import { createHash, randomBytes } from 'node:crypto';
import { webhookTargetIsAllowed } from './spaSysWebhook.js';

export function hashSpaSysKey(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

export function createIntegrationSecrets() {
  return {
    apiKey: randomBytes(32).toString('hex'),
    webhookSecret: randomBytes(32).toString('hex'),
  };
}

export function validateIntegrationName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) return { error: 'System name must be between 2 and 80 characters.' };
  if ([...name].some((character) => character.charCodeAt(0) < 32)) return { error: 'System name contains invalid characters.' };
  return { name };
}

export function validateWebhookUrl(value, nodeEnv = process.env.NODE_ENV) {
  const webhookUrl = String(value || '').trim();
  if (!webhookUrl) return { webhookUrl: '' };
  if (webhookUrl.length > 300 || !webhookTargetIsAllowed(webhookUrl, nodeEnv)) {
    return { error: 'Webhook URL must be an https address on a public host. Localhost is allowed only while developing.' };
  }
  return { webhookUrl };
}

export function publicIntegration(id, data = {}) {
  const iso = (value) => {
    if (!value) return null;
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };
  return {
    id,
    name: String(data.name || ''),
    status: data.status === 'revoked' ? 'revoked' : 'active',
    keyPreview: String(data.keyPreview || ''),
    webhookUrl: String(data.webhookUrl || ''),
    webhookConfigured: Boolean(data.webhookUrl && data.webhookSecret),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    lastUsedAt: iso(data.lastUsedAt),
    createdByName: String(data.createdByName || ''),
  };
}

export function assertIntegrationId(value) {
  const id = String(value || '');
  if (!/^[A-Za-z0-9]{8,180}$/.test(id)) return '';
  return id;
}
