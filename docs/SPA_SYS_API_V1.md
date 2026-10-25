# SPA_SYS_API_V1

Base path: `/api/spa-sys/v1`

SPA_SYS_API_V1 is the server-to-server JSON API for client details and spa visits. The caller is another system's backend. SpaGym remains the system of record. The same behavior is also available at `/api/integrations/client-data/v1` for a caller that already used that path.

The handoff for the other developer is [DEPENDENT_SYSTEM_SETUP.md](./DEPENDENT_SYSTEM_SETUP.md). Copy [integrations/spagym-client-data](../integrations/spagym-client-data) into their server.

## Security

- Send `Authorization: Bearer <SPA_SYS_API_KEY>` or `X-Api-Key`. The key is at least 32 characters, compared in constant time, and accepted only on the server. `CLIENT_DATA_API_KEY` still works as the same kind of secret.
- Production requests that arrive marked as HTTP are rejected. Call `https://`.
- Responses are `Cache-Control: private, no-store`. The route does not allow a browser to call it cross-origin.
- There is no export of every client. A read needs a phone number or at least two characters of a name.
- An update may change only name, phone, and birthday. Other JSON fields are ignored, including notes, next of kin, branch, and permissions.
- Birthday is stored as a month and a day. A year sent as `1990-03-15` is not kept, and responses set `dateOfBirth.year` to `null`.
- A phone change is refused with `409` `PHONE_IN_USE` when another client already has that number.
- Failed keys are limited to 30 per minute. Each key may make 40 reads and 30 updates or check-outs per minute, and no more than 120 accepted calls per minute, on each SpaGym server. A key may look up 100 different clients per hour. The same client again does not use another lookup.
- Every response includes `X-Request-Id`. The analytics log stores that id. An update or check-out log also stores the client id. Phone numbers, birthdays, API keys, and webhook secrets are not stored in the log.
- A key needs a permission for the call. `403` `FORBIDDEN` means that permission is missing. The service index works for any valid key. A branch or day register needs `checkins:register`. A phone or client-id check-in lookup needs `checkins:read`.
- New Admin registrations start with read clients, read one client's check-ins, and list branches. A stored key with no permission list, and an environment key when `SPA_SYS_API_SCOPES` is unset, keep every permission. Set `SPA_SYS_API_SCOPES` to a comma-separated list to narrow an environment key.
- A registration can set `expiresAt`. An empty expiry does not expire. Revoke stops the key immediately. Replacing the API key keeps the previous key working for 24 hours. Replacing the webhook secret takes effect immediately.
- Check-in alerts are HMAC signed. The webhook URL is set by the SpaGym operator, must be HTTPS, and cannot be a private, link-local, localhost, or metadata address. SpaGym resolves the host at send time and does not call the URL if any address is private or the name does not resolve. SpaGym does not follow redirects.

An approved Admin can register each external system from **Admin → SPA SYS API**. That screen chooses permissions and an optional expiry, creates the API key and webhook signing secret, shows each secret once, and keeps the same guide available as a PDF. The top administrator can open **Admin → API Analytics** to see how many reads, updates, check-outs, and distinct lookups each key made, whether each check-in webhook was delivered, and a log of each request with its success or error. The page marks a key with many lookups or many updates, and a high number of rejected calls. The environment variables below still work for a key that was set before that screen existed.

Generate an environment key with `openssl rand -hex 32`. Set it on SpaGym as `SPA_SYS_API_KEY`. Set the same value on the other server as `SPA_SYS_API_KEY`. A key created in Admin is a different secret: store the value shown on that screen, not a second key you invent.

## 1. Read client details

Phone is the primary lookup. `0782000000`, `782000000`, and `256782000000` match the same number, including when it is one of several numbers on the profile.

```http
GET /api/spa-sys/v1/clients?phone=0782000000
GET /api/spa-sys/v1/clients?search=Amina&limit=20
GET /api/spa-sys/v1/clients/abc123
GET /api/spa-sys/v1/clients/abc123/check-ins?from=2026-10-01&to=2026-10-24
GET /api/spa-sys/v1/check-ins?date=2026-10-24&branch=Kololo
GET /api/spa-sys/v1/branches
```

No phone match is `200` with `"clients": []`. An unknown client id is `404` `CLIENT_NOT_FOUND`. Name search needs two characters and returns at most 50 profiles. Check-in windows are at most 31 days. Omitted check-in dates mean today in Africa/Kampala.

```json
{
  "count": 1,
  "clients": [
    {
      "id": "abc123",
      "name": "Amina Nakato",
      "phoneNumber": "0782000000",
      "phoneNumbers": ["0782000000"],
      "dateOfBirth": { "month": 3, "day": 15, "monthName": "March", "monthDay": "03-15", "year": null },
      "branch": "Kololo",
      "createdAt": "2024-05-01T09:00:00.000Z",
      "updatedAt": null
    }
  ]
}
```

## 2. Update name, phone, or birthday

Send only the fields that change.

```http
PATCH /api/spa-sys/v1/clients/abc123
Content-Type: application/json

{ "name": "Amina Nakato", "phone": "0782000000", "dateOfBirth": { "month": 3, "day": 15 } }
```

Finding the client by phone, then updating:

```http
PATCH /api/spa-sys/v1/clients?phone=0782000000
Content-Type: application/json

{ "name": "Amina Nakato" }
```

`dateOfBirth` may also be `"03-15"` or `"1990-03-15"`. Only the month and day are stored. `"dateOfBirth": null` clears the birthday. If more than one client has the phone in the query, the response is `409` `AMBIGUOUS_CLIENT` and nothing is changed. The response body is `{ "client": { ... } }` using the same fields as a read.

## 3. Alert the other system when a client checks in

When GuestFlow or the SpaGym desk records a new check-in, SpaGym POSTs one JSON alert to `SPA_SYS_WEBHOOK_URL`. A repeated check-in for a visit that is already open does not send another alert. If the other system is down, the check-in is still saved.

SpaGym environment:

```env
SPA_SYS_WEBHOOK_URL=https://the-other-system.example/hooks/spagym
SPA_SYS_WEBHOOK_SECRET=a-second-random-secret-of-at-least-32-characters
```

```json
{
  "event": "client.checked_in",
  "api": "SPA_SYS_API_V1",
  "sentAt": "2026-10-24T06:12:05.000Z",
  "client": {
    "id": "abc123",
    "name": "Amina Nakato",
    "phoneNumber": "0782000000",
    "dateOfBirth": { "month": 3, "day": 15, "year": null },
    "branch": "Kololo"
  },
  "checkIn": {
    "id": "visit123",
    "clientId": "abc123",
    "branch": "Kololo",
    "visitDate": "2026-10-24",
    "checkedInAt": "2026-10-24T06:12:00.000Z",
    "status": "checked-in"
  }
}
```

Headers:

| Header | Value |
| --- | --- |
| `X-Spa-Sys-Event` | `client.checked_in` |
| `X-Spa-Sys-Delivery` | the visit id, for deduplication |
| `X-Spa-Sys-Timestamp` | unix seconds |
| `X-Spa-Sys-Signature` | `sha256=` plus HMAC-SHA256 of `{timestamp}.{raw body}` using `SPA_SYS_WEBHOOK_SECRET` |

The receiver must verify the HMAC on the exact raw body, reject a timestamp older than five minutes, and compare signatures in constant time. Persist `checkIn.id`. A repeated alert for that id must not create a second visit, message, or reward. `verifySpaSysWebhook()` in the copyable client does the signature, timestamp, and constant-time checks. Pass the raw request bytes. Respond `2xx` after the event is stored. SpaGym waits up to five seconds and does not follow a redirect.

## 4. Check out a client

```http
POST /api/spa-sys/v1/check-outs
Content-Type: application/json

{ "phone": "0782000000", "staffName": "Front desk" }
```

`visitId` or `clientId` can be sent instead of `phone`. Phone is resolved to the client's open visit. The response is `{ "checkIn": { ..., "status": "checked-out", "checkedOutAt": "...", "checkedOutBy": "Front desk" } }`. Checking out a visit that is already closed returns that same closed visit. No open visit is `404` `CHECK_IN_NOT_FOUND`.

`POST /api/spa-sys/v1/check-ins/{visitId}/checkout` is the same operation for a known visit id.

## Errors

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing phone or name, bad birthday, unknown branch, or empty update |
| 401 | `UNAUTHORIZED` | Key missing, wrong, revoked, or expired |
| 403 | `FORBIDDEN` | This key does not include that permission |
| 404 | `CLIENT_NOT_FOUND` or `CHECK_IN_NOT_FOUND` | No matching client, or no open visit |
| 405 | `METHOD_NOT_ALLOWED` | Method does not apply to that path |
| 409 | `PHONE_IN_USE` or `AMBIGUOUS_CLIENT` | Phone belongs to someone else, or matches more than one client |
| 429 | `RATE_LIMITED` | Honor `Retry-After` |
| 429 | `LOOKUP_LIMITED` | This key looked up too many different clients this hour |
| 500 | `INTERNAL` | The read or write could not be completed |

`GET /api/spa-sys/v1` with the key returns `{ "service": "SPA_SYS_API_V1", "readOnly": false }` and no client records.
