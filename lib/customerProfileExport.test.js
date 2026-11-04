import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CUSTOMER_PROFILE_EXPORT_FORMAT,
  buildCustomerProfileExport,
  customerProfileExportReply,
  serializeCustomerProfile,
} from './customerProfileExport.js';

test('exports the requested customer fields and leaves private data out', () => {
  const exportedAt = '2026-11-04T13:00:00.000Z';
  const document = buildCustomerProfileExport([
    {
      id: 'later',
      name: '  Amina Nakato  ',
      phoneNumber: '256782000000, 0758000000',
      phoneNumbers: ['0782000000'],
      birthMonth: 3,
      birthDay: 15,
      dateOfBirth: { toDate: () => new Date('2026-03-15T00:00:00Z') },
      branch: ' Kololo ',
      createdAt: { toDate: () => new Date('2024-05-01T09:00:00Z') },
      updatedAt: { toMillis: () => Date.parse('2025-01-02T08:30:00Z') },
      nextOfKin: 'Private relative',
      notes: 'Staff note',
      nameTokens: ['amina'],
      birthdayCalledByName: 'Front desk',
      birthdayContactMethod: 'called',
      checkIns: [{ id: 'visit-1' }],
      password: 'secret',
      paymentMethod: 'cash',
    },
    {
      id: 'earlier',
      name: 'John Okello',
      phoneNumber: '',
      branch: '',
      status: 'inactive',
    },
  ], { exportedAt });

  assert.equal(document.format, CUSTOMER_PROFILE_EXPORT_FORMAT);
  assert.equal(document.database, 'Cloud Firestore');
  assert.equal(document.collection, 'clients');
  assert.equal(document.count, 2);
  assert.deepEqual(document.customers.map((customer) => customer.id), ['earlier', 'later']);
  assert.deepEqual(document.customers[1], {
    id: 'later',
    name: 'Amina Nakato',
    primaryPhoneNumber: '0782000000',
    additionalPhoneNumbers: ['0758000000'],
    dateOfBirth: {
      month: 3,
      day: 15,
      monthName: 'March',
      monthDay: '03-15',
      year: null,
    },
    branch: 'Kololo',
    createdAt: '2024-05-01T09:00:00.000Z',
    updatedAt: '2025-01-02T08:30:00.000Z',
  });
  assert.equal(document.customers[0].primaryPhoneNumber, null);
  assert.deepEqual(document.customers[0].additionalPhoneNumbers, []);
  assert.equal(document.customers[0].dateOfBirth, null);
  assert.equal(document.customers[0].createdAt, null);
  assert.equal(document.customers[0].updatedAt, null);
  assert.deepEqual(Object.keys(document.customers[1]), document.includedFields);

  const serialized = JSON.stringify(document.customers);
  assert.equal(serialized.includes('2026'), false);
  assert.equal(serialized.includes('Private relative'), false);
  assert.equal(serialized.includes('Staff note'), false);
  assert.equal(serialized.includes('secret'), false);
  assert.equal(serialized.includes('cash'), false);
  assert.equal(serialized.includes('visit-1'), false);
  assert.equal(serialized.includes('Front desk'), false);
  assert.equal(serialized.includes('inactive'), false);
  assert.equal(document.customerIds.reused, false);
  assert.equal(document.changesFeed.customerCreatedWebhook, false);
  assert.equal(document.changesFeed.customerUpdatedWebhook, false);
  assert.equal(document.changesFeed.incrementalChangesEndpoint, false);
});

test('keeps a stored number that cannot be normalized', () => {
  const customer = serializeCustomerProfile('abc', {
    phoneNumbers: ['0782000000', 'extension-12'],
    phoneNumber: '0758000000',
  });
  assert.equal(customer.primaryPhoneNumber, '0782000000');
  assert.deepEqual(customer.additionalPhoneNumbers, ['extension-12', '0758000000']);
});

test('reply states the database, the exported count, id stability, and the missing change feed', () => {
  const reply = customerProfileExportReply({ count: 1280, exportedAt: '2026-11-04T13:00:00.000Z' });
  assert.match(reply, /Cloud Firestore/);
  assert.match(reply, /not the Firebase Realtime Database/);
  assert.match(reply, /1,280 customer profiles/);
  assert.match(reply, /2026-11-04T13:00:00.000Z UTC/);
  assert.match(customerProfileExportReply({ count: 1 }), /1 customer profile\./);
  assert.match(reply, /does not reuse an id/);
  assert.match(reply, /does not currently send a webhook when a customer is created or updated/);
  assert.match(reply, /incremental changes endpoint/);
  assert.match(reply, /client.checked_in|checks in/);
  assert.equal(reply.includes('0782000000'), false);
});
