import { serializeDateOfBirth } from './clientDataContract.js';
import { extractAllPhoneNumbers } from './phoneUtils.js';

export const CUSTOMER_PROFILE_EXPORT_FORMAT = 'spagym-customer-profiles-v1';

const CUSTOMER_FIELDS = [
  'id',
  'name',
  'primaryPhoneNumber',
  'additionalPhoneNumbers',
  'dateOfBirth',
  'branch',
  'createdAt',
  'updatedAt',
];

function asIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof value.toMillis === 'function') {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (value && typeof value === 'object' && Number.isFinite(value._seconds)) {
    const millis = (value._seconds * 1000) + Math.floor((value._nanoseconds || 0) / 1e6);
    return new Date(millis).toISOString();
  }
  return null;
}

function addPhone(phones, value) {
  const text = String(value ?? '').trim();
  if (!text) return;
  const normalized = extractAllPhoneNumbers(text);
  const chosen = normalized.length ? normalized : [text];
  chosen.forEach((phone) => {
    const entry = String(phone || '').trim();
    if (entry && !phones.includes(entry)) phones.push(entry);
  });
}

function phoneNumbersFor(data = {}) {
  const phones = [];
  const stored = Array.isArray(data.phoneNumbers) ? data.phoneNumbers : [];
  stored.forEach((phone) => addPhone(phones, phone));
  addPhone(phones, data.phoneNumber);
  return phones;
}

export function serializeCustomerProfile(id, data = {}) {
  const phones = phoneNumbersFor(data);
  return {
    id: String(id || ''),
    name: String(data.name || '').trim(),
    primaryPhoneNumber: phones[0] || null,
    additionalPhoneNumbers: phones.slice(1),
    dateOfBirth: serializeDateOfBirth(data),
    branch: String(data.branch || '').trim(),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
  };
}

export function buildCustomerProfileExport(records = [], { exportedAt = new Date().toISOString() } = {}) {
  const customers = records
    .map((record) => serializeCustomerProfile(record?.id, record || {}))
    .filter((customer) => customer.id)
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    format: CUSTOMER_PROFILE_EXPORT_FORMAT,
    database: 'Cloud Firestore',
    collection: 'clients',
    exportedAt,
    count: customers.length,
    customerIds: {
      stable: true,
      reused: false,
      description: 'Each id is the Cloud Firestore document id assigned when the profile was created. SpaGym does not assign that id to another customer. A deleted profile is removed, and a later profile receives a new id.',
    },
    profiles: {
      includesEveryStoredCustomer: true,
      inactiveFlag: false,
      description: 'Customer profiles have no active or inactive status. Every profile still stored in clients is included, including customers without a current membership. Membership status is stored separately and is not part of this export. A deleted profile is no longer in the database.',
    },
    includedFields: CUSTOMER_FIELDS,
    excluded: [
      'check-in history',
      'authentication credentials',
      'payment and invoice records',
      'memberships',
      'notes',
      'next of kin',
      'birthday-call notes',
      'birth year',
    ],
    changesFeed: {
      customerCreatedWebhook: false,
      customerUpdatedWebhook: false,
      incrementalChangesEndpoint: false,
      availableNow: 'SpaGym sends a signed webhook for client.checked_in only. SPA_SYS_API_V1 can read one customer by id or phone. It does not list every customer, and it does not send customer-created or customer-updated events.',
    },
    customers,
  };
}

function formatCount(value) {
  return String(Number(value) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function customerProfileExportReply({ count = 0, exportedAt = '' } = {}) {
  const total = Number(count) || 0;
  const profiles = total === 1 ? 'profile' : 'profiles';
  const when = exportedAt ? ` The file was exported at ${exportedAt} UTC.` : '';
  return [
    'The customer profiles are stored in Cloud Firestore, in the clients collection. This is not the Firebase Realtime Database.',
    '',
    `The export contains ${formatCount(total)} customer ${profiles}. That is every customer profile currently stored.${when} SpaGym does not mark a customer profile inactive. A profile stays in clients until it is deleted, so customers without a current membership are included. The file leaves out check-in history, authentication credentials, payment and invoice records, memberships, notes, next of kin, and birthday-call notes. A birth year is not included, because SpaGym stores only the birthday month and day. A profile that was deleted is no longer in the database, so it is not in the export.`,
    '',
    'Each customer id is the Cloud Firestore document id assigned when the profile was created. Those ids are stable. SpaGym does not reuse an id for another customer. Deleting a profile removes it, and a later profile receives a new id.',
    '',
    'SpaGym does not currently send a webhook when a customer is created or updated, and it does not offer an incremental changes endpoint. It can send a signed webhook when a customer checks in. Another system can also read one customer by id or phone through SPA_SYS_API_V1. Another full export from the same admin page is the way to take a later snapshot. Customer-created and customer-updated webhooks can be added later if you want them.',
  ].join('\n');
}

export function customerProfileExportSummary(exportDocument) {
  const { customers, ...summary } = exportDocument;
  return {
    ...summary,
    count: customers.length,
    reply: customerProfileExportReply({ count: customers.length }),
  };
}
