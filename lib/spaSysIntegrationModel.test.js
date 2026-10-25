import assert from 'node:assert/strict';
import test from 'node:test';
import { grantSpaSysAccess } from './clientDataContract.js';
import {
  createIntegrationSecrets,
  hashSpaSysKey,
  publicIntegration,
  validateIntegrationName,
  validateWebhookUrl,
} from './spaSysIntegrationModel.js';

test('registration view hides the key and webhook secret', () => {
  const secrets = createIntegrationSecrets();
  assert.equal(secrets.apiKey.length, 64);
  assert.notEqual(secrets.apiKey, secrets.webhookSecret);
  const view = publicIntegration('abc12345', {
    name: 'Front desk',
    status: 'active',
    keyPreview: secrets.apiKey.slice(0, 8),
    keyHash: hashSpaSysKey(secrets.apiKey),
    webhookUrl: 'https://partner.example/hooks/spagym',
    webhookSecret: secrets.webhookSecret,
    createdAt: '2026-10-24T12:00:00.000Z',
    scopes: ['clients:read', 'branches:read'],
    expiresAt: '2026-12-01T00:00:00.000Z',
    previousKeyHash: hashSpaSysKey(`old-${secrets.apiKey}`),
    previousKeyExpiresAt: '2026-10-25T12:00:00.000Z',
  });
  const encoded = JSON.stringify(view);
  assert.equal(encoded.includes(secrets.apiKey), false);
  assert.equal(encoded.includes(secrets.webhookSecret), false);
  assert.equal(encoded.includes('keyHash'), false);
  assert.equal(encoded.includes('previousKeyHash'), false);
  assert.equal(view.webhookConfigured, true);
  assert.equal(view.keyPreview, secrets.apiKey.slice(0, 8));
  assert.deepEqual(view.scopes, ['clients:read', 'branches:read']);
  assert.equal(view.expiresAt, '2026-12-01T00:00:00.000Z');
  assert.equal(view.previousKeyUntil, '2026-10-25T12:00:00.000Z');
  const legacy = publicIntegration('abc12345', { name: 'Older system' });
  assert.equal(legacy.scopes.length, 6);
  assert.equal(legacy.expiresAt, null);
});

test('rejects a private webhook and a blank system name', () => {
  assert.equal(validateIntegrationName('  A ').error, 'System name must be between 2 and 80 characters.');
  assert.equal(validateIntegrationName('Front desk').name, 'Front desk');
  assert.ok(validateWebhookUrl('https://169.254.169.254/latest', 'production').error);
  assert.equal(validateWebhookUrl('https://partner.example/hooks/spagym', 'production').webhookUrl, 'https://partner.example/hooks/spagym');
  assert.equal(validateWebhookUrl('', 'production').webhookUrl, '');
});

test('a registered key uses the same success limit as an environment key', () => {
  const acceptedRequests = new Map();
  const input = { presentedKey: 'k'.repeat(40), address: '198.51.100.8', acceptedRequests, successLimit: 1 };
  assert.equal(grantSpaSysAccess(input).status, 200);
  assert.equal(grantSpaSysAccess(input).status, 429);
});
