export const SPA_SYS_GUIDE = {
  title: 'SPA_SYS_API_V1',
  subtitle: 'How another system reads and updates SpaGym clients',
  basePath: '/api/spa-sys/v1',
  sections: [
    {
      heading: '1. What this API does',
      blocks: [
        { type: 'paragraph', text: 'SPA_SYS_API_V1 lets one external server read a client, update the name, phone number, and birthday, check a client out, and receive an alert when that client checks in. SpaGym remains the system of record. The external product calls SpaGym from its own server. A browser, kiosk, or phone app must not hold the API key.' },
        { type: 'bullets', items: [
          'Read client details, most often by phone number. Name search and client id are also available.',
          'Update name, phone number, and birthday. No other client fields can be changed through this API.',
          'Receive a signed alert when a client checks in through GuestFlow or the SpaGym desk.',
          'Check a client out by phone, client id, or visit id.',
        ] },
        { type: 'note', text: 'Birthday is a month and a day. SpaGym does not store a birth year. dateOfBirth.year is always null. Do not calculate an age from it.' },
      ],
    },
    {
      heading: '2. Register the system in Admin',
      blocks: [
        { type: 'paragraph', text: 'An approved Admin opens Admin, then SPA SYS API, then Setup. Registration creates a key for one external system. The full API key and webhook signing secret are shown once on that screen. Store them in the other system\'s server environment. SpaGym stores only a hash of the API key.' },
        { type: 'steps', items: [
          'Enter the other system\'s name, for example Front desk app.',
          'Optional: enter the HTTPS address that should receive check-in alerts.',
          'Leave the read permissions selected, and add update, register, or check-out only if that system needs them.',
          'Leave expiry empty unless the key should stop on a chosen date.',
          'Choose Register system.',
          'Copy the base URL, API key, and webhook secret into a password manager, then into the other server.',
          'Confirm the other server can call GET /api/spa-sys/v1 and receive service SPA_SYS_API_V1.',
        ] },
        { type: 'paragraph', text: 'A new registration can read clients, read one client\'s check-ins, and list branches. A registration created before permissions existed keeps every permission. An environment key also keeps every permission unless SPA_SYS_API_SCOPES lists a smaller set, separated by commas.' },
        { type: 'bullets', items: [
          'Read clients: phone, name, and client id.',
          'Update name, phone, and birthday.',
          'Read one client\'s check-ins by phone or client id.',
          'Read a branch or day register.',
          'Check a client out.',
          'List branches.',
        ] },
        { type: 'paragraph', text: 'Leave expiry empty for a key that does not expire. A past expiry is rejected. Revoke stops that key immediately. Rotate key shows a new key once and keeps the previous API key working for 24 hours. Rotate webhook secret replaces the signing secret immediately. SPA_SYS_API_KEY and SPA_SYS_WEBHOOK_URL still work beside keys created on this screen.' },
      ],
    },
    {
      heading: '3. Call the API securely',
      blocks: [
        { type: 'paragraph', text: 'Every request uses HTTPS and one of these headers. If both headers are sent, they must be identical. The key is at least 32 characters. Do not put it in a query string, a NEXT_PUBLIC variable, or page JavaScript.' },
        { type: 'code', text: 'Authorization: Bearer THE_API_KEY\nX-Api-Key: THE_API_KEY' },
        { type: 'paragraph', text: 'A startup check returns no client records:' },
        { type: 'code', text: 'GET /api/spa-sys/v1' },
        { type: 'paragraph', text: 'Wrong keys are limited to 30 attempts per minute. Each key may make 40 reads and 30 updates or check-outs per minute, and no more than 120 accepted calls per minute, on each SpaGym server. A key may look up at most 100 different clients per hour. The same client again does not use another lookup. A missing permission is HTTP 403 FORBIDDEN. Too many different clients is HTTP 429 LOOKUP_LIMITED. Every response includes X-Request-Id. Responses use Cache-Control: private, no-store. The route does not allow a website to call it from another origin.' },
      ],
    },
    {
      heading: '4. Read a client',
      blocks: [
        { type: 'paragraph', text: 'Phone is the primary lookup. 0782000000, 782000000, and 256782000000 match the same Ugandan number, including when it is one of several numbers saved on the profile. No match returns HTTP 200 and an empty clients array. An unknown client id returns HTTP 404.' },
        { type: 'code', text: 'GET /api/spa-sys/v1/clients?phone=0782000000\nGET /api/spa-sys/v1/clients?search=Amina&limit=20\nGET /api/spa-sys/v1/clients/{clientId}\nGET /api/spa-sys/v1/clients/{clientId}/check-ins?from=2026-10-01&to=2026-10-24\nGET /api/spa-sys/v1/check-ins?date=2026-10-24&branch=Kololo\nGET /api/spa-sys/v1/branches' },
        { type: 'paragraph', text: 'Name search needs at least two characters and returns at most 50 profiles. Send a phone or a name, not both. Check-in dates use YYYY-MM-DD. A range is inclusive and at most 31 days. If date, from, and to are omitted, the date is today in Africa/Kampala. Visit timestamps are UTC. visitDate is the Kampala calendar date. A check-in list for one client uses the read check-ins permission. A list for a branch or a day, with no phone and no client id, uses the register permission and does not count toward the 100-client lookup ceiling.' },
        { type: 'code', text: '{\n  "count": 1,\n  "clients": [{\n    "id": "abc123",\n    "name": "Amina Nakato",\n    "phoneNumber": "0782000000",\n    "phoneNumbers": ["0782000000"],\n    "dateOfBirth": { "month": 3, "day": 15, "monthName": "March", "monthDay": "03-15", "year": null },\n    "branch": "Kololo"\n  }]\n}' },
      ],
    },
    {
      heading: '5. Update name, phone, or birthday',
      blocks: [
        { type: 'paragraph', text: 'Send only the fields that should change. Branch, notes, next of kin, invoices, and permissions are ignored. A full date such as 1990-03-15 stores March 15 and discards 1990. Setting dateOfBirth to null clears the birthday.' },
        { type: 'code', text: 'PATCH /api/spa-sys/v1/clients/abc123\nContent-Type: application/json\n\n{\n  "name": "Amina Nakato",\n  "phone": "0782000000",\n  "dateOfBirth": { "month": 3, "day": 15 }\n}' },
        { type: 'paragraph', text: 'If the other system has the phone but not the id, it can update the single matching client:' },
        { type: 'code', text: 'PATCH /api/spa-sys/v1/clients?phone=0782000000\nContent-Type: application/json\n\n{ "name": "Amina Nakato" }' },
        { type: 'paragraph', text: 'HTTP 409 PHONE_IN_USE means another client already uses the new phone. HTTP 409 AMBIGUOUS_CLIENT means more than one client has the phone in the query. Nothing is changed in either case. Use the client id after the person picks the right profile.' },
      ],
    },
    {
      heading: '6. Check a client out',
      blocks: [
        { type: 'paragraph', text: 'Check-out closes the client\'s open visit. Phone is enough when exactly one client has that number. visitId or clientId can be sent instead. A visit that is already closed returns that same closed visit. No open visit returns HTTP 404 CHECK_IN_NOT_FOUND.' },
        { type: 'code', text: 'POST /api/spa-sys/v1/check-outs\nContent-Type: application/json\n\n{ "phone": "0782000000", "staffName": "Front desk" }\n\nPOST /api/spa-sys/v1/check-ins/{visitId}/checkout\nContent-Type: application/json\n\n{ "staffName": "Front desk" }' },
        { type: 'paragraph', text: 'The response field checkIn includes status checked-out, checkedOutAt, and checkedOutBy. A visit still open 12 hours after arrival is reported as checked out by Automatic (12-hour timeout), which is the same rule the spa desk uses.' },
      ],
    },
    {
      heading: '7. Check-in alerts',
      blocks: [
        { type: 'paragraph', text: 'When a new check-in is saved, SpaGym POSTs one JSON alert to each active registration that has an HTTPS webhook URL, and also to SPA_SYS_WEBHOOK_URL when that environment value is set. A repeated check-in for a visit that is already open does not send another alert. If the receiver is down, the check-in is still saved. SpaGym resolves the webhook host before sending and refuses a private, link-local, localhost, or metadata address. A name that does not resolve is not called. SpaGym waits up to five seconds and does not follow redirects.' },
        { type: 'code', text: '{\n  "event": "client.checked_in",\n  "api": "SPA_SYS_API_V1",\n  "client": { "id": "abc123", "name": "Amina Nakato", "phoneNumber": "0782000000", "dateOfBirth": { "month": 3, "day": 15, "year": null } },\n  "checkIn": { "id": "visit123", "visitDate": "2026-10-24", "checkedInAt": "2026-10-24T06:12:00.000Z", "status": "checked-in" }\n}' },
        { type: 'paragraph', text: 'The receiver must verify the HMAC on the exact raw body, reject a timestamp older than five minutes, and compare signatures in constant time. The signed text is the header timestamp, a period, then the raw body. X-Spa-Sys-Signature is sha256= plus the hex HMAC. Persist checkIn.id. A repeated alert for that id must not create a second visit, message, or reward.' },
        { type: 'table', columns: ['Header', 'Meaning'], rows: [
          ['X-Spa-Sys-Event', 'client.checked_in'],
          ['X-Spa-Sys-Delivery', 'Visit id, for deduplication'],
          ['X-Spa-Sys-Timestamp', 'Unix time in seconds'],
          ['X-Spa-Sys-Signature', 'sha256= HMAC of timestamp.rawBody'],
        ] },
        { type: 'paragraph', text: 'The copyable server module integrations/spagym-client-data exposes verifySpaSysWebhook({ secret, timestamp, rawBody, signature }). Pass the raw request bytes, not a JSON object that was parsed and serialized again.' },
      ],
    },
    {
      heading: '8. Errors and limits',
      blocks: [
        { type: 'table', columns: ['HTTP', 'Code', 'What to do'], rows: [
          ['400', 'VALIDATION_ERROR', 'Fix the phone, name, date, branch, or empty update.'],
          ['401', 'UNAUTHORIZED', 'Stop and correct the key. Do not keep guessing.'],
          ['403', 'FORBIDDEN', 'This key does not include that permission.'],
          ['404', 'CLIENT_NOT_FOUND', 'That id or phone is not a client. A phone search with no match is an empty list, not a 404.'],
          ['404', 'CHECK_IN_NOT_FOUND', 'That client has no open visit.'],
          ['405', 'METHOD_NOT_ALLOWED', 'Use the method shown for that path.'],
          ['409', 'PHONE_IN_USE', 'Choose a phone that is not already saved on another client.'],
          ['409', 'AMBIGUOUS_CLIENT', 'Ask the person to pick a profile, then use the client id.'],
          ['429', 'RATE_LIMITED', 'Wait for the Retry-After value, then try once.'],
          ['429', 'LOOKUP_LIMITED', 'This key looked up too many different clients this hour.'],
          ['500', 'INTERNAL', 'Show a temporary failure. Reads may be retried. Do not blindly retry an update.'],
        ] },
        { type: 'note', text: 'There is no request that downloads every client. Query strings contain phone numbers, so the other server should not log full URLs. The API key and webhook secret must stay in server environment variables.' },
      ],
    },
  ],
};
