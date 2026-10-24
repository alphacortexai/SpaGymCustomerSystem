# SpaGym client data API

This API is **SPA_SYS_API_V1**. Its canonical path is `/api/spa-sys/v1`. Start with [docs/SPA_SYS_API_V1.md](./docs/SPA_SYS_API_V1.md) for read, update, check-out, and check-in alerts. The other developer follows [docs/DEPENDENT_SYSTEM_SETUP.md](./docs/DEPENDENT_SYSTEM_SETUP.md).

The paths below under `/api/integrations/client-data/v1` remain available and run the same handlers. New calls should use `/api/spa-sys/v1`.

SpaGym remains the system of record for client profiles and spa visits. This API lets one external server read that data as JSON. It is a separate door from the GuestFlow integration: GuestFlow can register clients and record visits, while this API can only read.

The external system never talks to Firestore, and the shared key never goes in a browser. Its server calls SpaGym's server. SpaGym reads `clients` and `guestflowVisits` with the Firebase Admin SDK and returns an allow-listed JSON document.

## What the external system can read

Each client document contains only:

| Field | Meaning |
| --- | --- |
| `id` | SpaGym client id. Use this id for later check-in queries. |
| `name` | Client name. |
| `phoneNumber` | Phone numbers as SpaGym stores them. Several numbers are comma-separated. |
| `phoneNumbers` | The same numbers, normalized, one entry per number. |
| `dateOfBirth` | Birthday month and day. `year` is always `null`. |
| `branch` | Branch name saved on the profile. |
| `createdAt`, `updatedAt` | ISO-8601 timestamps. |

SpaGym's forms and spreadsheet import keep a birthday as a month and a day. The year stored beside that birthday is a placeholder, so this API does not return it and the other system must not calculate an age from it.

Each check-in contains the visit id, client id, name, phone, birthday, branch where the client arrived, visit date, `checkedInAt`, `checkedOutAt`, `checkedOutBy`, and `status` (`checked-in` or `checked-out`). A visit that is still open 12 hours after arrival is reported as checked out by `Automatic (12-hour timeout)`, which is the same rule the spa desk uses.

Notes, next of kin, invoices, birthday-call notes, and staff accounts are not included.

## How the two servers communicate

```text
External server                         SpaGym
      |                                    |
      |  GET /api/integrations/client-data/v1/...
      |  Authorization: Bearer <CLIENT_DATA_API_KEY>
      |  HTTPS only                        |
      | ---------------------------------> |
      |                                    |  Admin SDK reads Firestore
      |                                    |  (browser and public rules cannot)
      |  200 application/json              |
      | <--------------------------------- |
```

1. On SpaGym, generate a key and set it in the server environment as `CLIENT_DATA_API_KEY`. Deploy SpaGym.
2. On the external server, store that same value as a server-only secret, for example `SPAGYM_CLIENT_DATA_API_KEY`. Also store SpaGym's origin as `SPAGYM_API_URL` (no `/api` suffix).
3. The external application calls SpaGym from its own backend. A browser, mobile app, or kiosk must not see the key. If a person is using the external product, that product calls SpaGym and then shows the result.
4. SpaGym compares the key in constant time, reads the requested records, and answers with JSON. Responses are marked `Cache-Control: private, no-store` so shared caches do not keep client data.
5. The external server treats `401` as a configuration or key problem, `429` as a pause (honor `Retry-After`), `404` as a missing client, and `5xx` as a retry with backoff.

There is no cross-origin browser access. A page that called this API directly would have to contain the key, so the route does not send `Access-Control-Allow-Origin`.

## Configure the key

Generate a key of at least 32 characters:

```bash
openssl rand -hex 32
```

Set it only in SpaGym's server environment:

```env
CLIENT_DATA_API_KEY=the-generated-key
```

Do not prefix it with `NEXT_PUBLIC_`. Do not commit it. The same Firebase Admin variables used by GuestFlow must also be present (`FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY`, or `GOOGLE_APPLICATION_CREDENTIALS`), because the route reads Firestore with the Admin SDK.

To rotate the key without an outage, set both the current key and the next key, separated by a comma:

```env
CLIENT_DATA_API_KEY=current-key,next-key
```

Deploy SpaGym, switch the external server to the next key, then remove the current key and deploy again. Keys cannot contain spaces or commas. If the variable is missing, shorter than 32 characters, or contains a space, every request is rejected.

This key does not grant GuestFlow write access. Keep `GUESTFLOW_API_KEY` separate.

Firestore rules stay closed to the public. The Admin SDK bypasses those rules, and this key is the gate.

## Authentication

Send the key on every request in either header:

```http
Authorization: Bearer THE_KEY
```

or:

```http
X-Api-Key: THE_KEY
```

If both headers are present they must be identical. Call the `https://` origin. In production, a request whose proxy reports plain HTTP (`X-Forwarded-Proto: http`) is rejected. Local `npm run dev` stays on HTTP so the route can be tested on the machine; do not expose that development server.

A successful call to the index confirms the key without returning client records:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $SPAGYM_CLIENT_DATA_API_KEY" \
  "$SPAGYM_API_URL/api/integrations/client-data/v1"
```

`200` means the key works. `401` means the route is deployed and the key was not accepted.

Failed attempts are limited to 30 per minute for a source address and for the same wrong key. Accepted calls are limited to 120 per minute for the key. Limits are counted on each running server instance, so they blunt a tight loop; they are not a global quota. The JSON error is `{ "error": { "code": "RATE_LIMITED", "message": "..." } }` and the response includes `Retry-After`.

## Endpoints

All paths are under `/api/integrations/client-data/v1`. Only `GET` is accepted. Any other method returns `405`.

### List branches

```http
GET /api/integrations/client-data/v1/branches
```

```json
{ "branches": [{ "id": "branch123", "name": "Kololo" }] }
```

Use `id` or `name` as the `branch` filter on check-in queries. The check-in response uses the branch name.

### Find clients

Exact phone lookup. `0782000000`, `782000000`, and `256782000000` match the same Ugandan number, including when it is one of several numbers on the profile.

```http
GET /api/integrations/client-data/v1/clients?phone=0782000000
```

Name search needs at least two characters and returns at most 50 profiles. `limit` defaults to 20.

```http
GET /api/integrations/client-data/v1/clients?search=Amina&limit=20
```

Send `phone` or `search`, not both. There is no unfiltered list of every client.

```json
{
  "count": 1,
  "clients": [
    {
      "id": "abc123",
      "name": "Amina Nakato",
      "phoneNumber": "0782000000",
      "phoneNumbers": ["0782000000"],
      "dateOfBirth": {
        "month": 3,
        "day": 15,
        "monthName": "March",
        "monthDay": "03-15",
        "year": null
      },
      "branch": "Kololo",
      "createdAt": "2024-05-01T09:00:00.000Z",
      "updatedAt": null
    }
  ]
}
```

No match is `200` with `"count": 0` and `"clients": []`.

### Read one client

```http
GET /api/integrations/client-data/v1/clients/abc123
```

```json
{ "client": { "id": "abc123", "name": "Amina Nakato" } }
```

An unknown id is `404` with code `CLIENT_NOT_FOUND`.

### Read check-ins

Today means the current date in Africa/Kampala when `date`, `from`, and `to` are omitted.

```http
GET /api/integrations/client-data/v1/check-ins?date=2026-10-24&branch=Kololo
GET /api/integrations/client-data/v1/check-ins?from=2026-10-01&to=2026-10-07&phone=0782000000
GET /api/integrations/client-data/v1/clients/abc123/check-ins?from=2026-10-01&to=2026-10-24
```

Use either `date` or both `from` and `to`. The range is inclusive and at most 31 days. `branch` accepts a SpaGym branch id or branch name. `phone` and `clientId` are optional filters on the register route; the client route already supplies the id.

```json
{
  "from": "2026-10-24",
  "to": "2026-10-24",
  "branch": "Kololo",
  "count": 1,
  "matched": 1,
  "truncated": false,
  "checkIns": [
    {
      "id": "visit123",
      "clientId": "abc123",
      "name": "Amina Nakato",
      "phoneNumber": "0782000000",
      "phoneNumbers": ["0782000000"],
      "dateOfBirth": { "month": 3, "day": 15, "monthName": "March", "monthDay": "03-15", "year": null },
      "branch": "Kololo",
      "visitDate": "2026-10-24",
      "checkedInAt": "2026-10-24T06:12:00.000Z",
      "checkedOutAt": null,
      "checkedOutBy": "",
      "status": "checked-in"
    }
  ]
}
```

`truncated` is true when more than 500 visits matched. `count` is the number returned. Narrow the request by branch, phone, client, or a shorter date range. The newest arrivals are returned first.

A client check-in query for an unknown client id is `404`, so an empty register is not mistaken for a missing profile.

## Errors

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Provide a phone number or at least two characters of a name." } }
```

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing search, bad date, unknown branch, or invalid id |
| 400 | `HTTPS_REQUIRED` | The proxy reported HTTP |
| 401 | `UNAUTHORIZED` | Missing, wrong, or unconfigured key |
| 404 | `CLIENT_NOT_FOUND` or `NOT_FOUND` | Unknown client, or unknown path |
| 405 | `METHOD_NOT_ALLOWED` | Anything other than GET |
| 429 | `RATE_LIMITED` | Too many failures or too many accepted calls |
| 500 | `INTERNAL` | SpaGym could not complete the read |

## Suggested call sequence

1. `GET /api/integrations/client-data/v1` once at startup to confirm the key.
2. When a person asks for a client, `GET /clients?phone=...` or `GET /clients?search=...`.
3. Keep the returned `id`.
4. `GET /clients/{id}/check-ins` for that client's visits, or `GET /check-ins?date=...&branch=...` for a day's register.
5. Repeat the register read when the external screen refreshes. Stay inside the rate limit; a one-day, one-branch query is the normal poll.

## Operational checks

- Confirm a known phone returns that client's name and birthday month/day, and that a second unrelated phone returns an empty list.
- Confirm today's register for one branch matches the Spa check-ins screen.
- Confirm `POST` returns `405` and a request without the key returns `401`.
- After rotating the key, confirm the old key returns `401` and the new key returns `200` on the index.
- Keep the key out of logs. Query strings contain phone numbers, so the external server should avoid logging full URLs. SpaGym's normal request log also includes the path and query string; restrict who can read production logs.
