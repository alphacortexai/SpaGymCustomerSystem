# SpaGym client data: setup for the dependent system

This guide is for the developer whose system uses **SPA_SYS_API_V1**. SpaGym keeps the records. Your server reads clients, updates name, phone, and birthday, checks a client out, and receives a signed alert when someone checks in. Your users never call SpaGym directly.

The field contract is [SPA_SYS_API_V1.md](./SPA_SYS_API_V1.md). The code to copy is [integrations/spagym-client-data](../integrations/spagym-client-data). The base path is `/api/spa-sys/v1`.

## What you can read

Your server can ask for:

- a client’s name
- phone number, including a profile that stores more than one number
- birthday as a month and a day
- the branch saved on the profile
- spa check-ins: when the client arrived, when they left, which branch, and whether the visit is still open

SpaGym does not store a birth year. `dateOfBirth.year` is always `null`. Display “15 March”. Do not calculate an age.

Your key can read those fields, change name, phone, and birthday, and check a client out. It cannot create a client, change notes, or change a branch. GuestFlow remains the check-in writer. Use only the values in this guide.

## Who does what

| Step | SpaGym operator | You |
| --- | --- | --- |
| Deploy the client-data API | Deploys SpaGym with this API and the Firebase Admin credentials | Wait for the origin URL |
| Create the key | Runs `openssl rand -hex 32` and sets `SPA_SYS_API_KEY` on the SpaGym server | Do not invent a second key |
| Hand off | Sends you the SpaGym origin and the key through a private channel | Store both in the server environment |
| Build | Confirms a known phone in the SpaGym desk | Call SpaGym only from your server, then show the JSON result in your own UI |
| Check together | Compares your result with the Spa check-ins screen | Runs the joint checklist at the end of this guide |

The origin looks like `https://spagym.example`. It has no `/api` suffix and no key in it.

## Install

Copy the folder `integrations/spagym-client-data` from this repository into your server project. The client is `client.js`. It has no npm dependencies and needs Node.js 18 or newer.

From that folder, the setup is:

```javascript
import { createSpaGymClient, SpaGymApiError } from './client.js';

const spagym = createSpaGymClient();
```

`createSpaGymClient()` reads the environment variables below. You can also pass `{ baseUrl, apiKey }` in tests.

## Environment

On your server, not in frontend code:

```env
SPAGYM_API_URL=https://spagym.example
SPA_SYS_API_KEY=the-same-value-as-SpaGym-SPA_SYS_API_KEY
SPA_SYS_WEBHOOK_SECRET=the-secret-SpaGym-uses-to-sign-check-in-alerts
```

A template is in `integrations/spagym-client-data/env.example`.

- `SPAGYM_API_URL` is the origin only. `https://spagym.example/api` is rejected.
- The key is at least 32 characters and contains no spaces.
- Use a name that your frontend build does not inline. In a Next.js app, do not use `NEXT_PUBLIC_`.
- `http://127.0.0.1` and `http://localhost` are accepted so you can point at a local SpaGym during development. Every other host must be `https://`.

Confirm the key before writing screens:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $SPA_SYS_API_KEY" \
  "$SPAGYM_API_URL/api/spa-sys/v1"
```

A working key returns JSON with `"service": "SPA_SYS_API_V1"`. No client names are in that response. `401` means the route is deployed and the key does not match.

The same check in code:

```javascript
const service = await spagym.ping();
if (service.service !== 'SPA_SYS_API_V1') throw new Error('Unexpected SpaGym response.');
```

## Keep the key on your server

```text
Person using your product
        |
        |  calls your own route, for example GET /api/clients?phone=
        v
Your server  ---- HTTPS + Bearer key ---->  SpaGym
        |
        |  returns your own JSON to the person
        v
Your page, app, or kiosk
```

SpaGym does not send `Access-Control-Allow-Origin`, so a browser page that tried to call SpaGym would fail, and it would have to contain the key. Add a route on your side instead:

```javascript
import { createSpaGymClient, SpaGymApiError } from './spagym-client-data/client.js';

const spagym = createSpaGymClient();

export async function getClients(request, response) {
  try {
    const phone = new URL(request.url, 'http://local').searchParams.get('phone') || '';
    const search = new URL(request.url, 'http://local').searchParams.get('search') || '';
    const result = phone
      ? await spagym.findClients({ phone })
      : await spagym.findClients({ search });
    response.statusCode = 200;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 'private, no-store');
    response.end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof SpaGymApiError && error.status ? error.status : 502;
    response.statusCode = status;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: { code: error.code || 'UPSTREAM', message: error.message } }));
  }
}
```

Log your own route name. Do not log the SpaGym URL, because the query string contains a phone number. Do not log the Authorization header.

## Which call to make

| What the person is doing | Call |
| --- | --- |
| Open the integration and confirm the key | `spagym.ping()` |
| Fill a branch filter | `spagym.listBranches()` |
| Look up the number they typed | `spagym.findClients({ phone })` |
| Look up a name | `spagym.findClients({ search, limit })` |
| Open the profile they picked | `spagym.getClient(id)` |
| Show that client’s visits | `spagym.listClientCheckIns(id, { from, to })` |
| Show one day’s register | `spagym.listCheckIns({ date, branch })` |
| Correct a name, phone, or birthday | `spagym.updateClient(id, changes)` or `spagym.updateClientByPhone(phone, changes)` |
| Record that the client left | `spagym.checkOut({ phone, staffName })` |

Search needs at least two characters. `limit` defaults to 20 and cannot exceed 50. Send a phone or a name, not both. Several people can share a name: show the list and continue with the `id` the person selects. An unknown phone is a successful response with `count: 0` and `clients: []`. An unknown client id is `SpaGymApiError` with `code` `CLIENT_NOT_FOUND`.

Check-in dates use `YYYY-MM-DD`. Omit `date`, `from`, and `to` to get today in Africa/Kampala. Send either `date`, or both `from` and `to`. The range is inclusive and at most 31 days. `branch` may be the branch id or the branch name from `listBranches()`. The visits in the response use the branch name.

A register refresh should be one branch and one day. The accepted-call limit is 120 requests per minute for your key on each SpaGym instance. There is no call that downloads every client.

Update with the id you stored, or by the same phone:

```javascript
await spagym.updateClient(clientId, { name: 'Amina Nakato', dateOfBirth: { month: 3, day: 15 } });
await spagym.updateClientByPhone('0782000000', { phone: '0782111111' });
await spagym.checkOut({ phone: '0782000000', staffName: 'Front desk' });
```

Give the SpaGym operator your HTTPS webhook URL. They set `SPA_SYS_WEBHOOK_URL` and a separate `SPA_SYS_WEBHOOK_SECRET`, and they give you that signing secret. On your server:

```javascript
import { verifySpaSysWebhook } from './spagym-client-data/client.js';

export async function receiveCheckIn(request, response) {
  const rawBody = await request.text();
  const trusted = verifySpaSysWebhook({
    secret: process.env.SPA_SYS_WEBHOOK_SECRET,
    timestamp: request.headers['x-spa-sys-timestamp'],
    rawBody,
    signature: request.headers['x-spa-sys-signature'],
  });
  if (!trusted) {
    response.statusCode = 401;
    response.end();
    return;
  }
  const alert = JSON.parse(rawBody);
  if (alert.event === 'client.checked_in') {
    // Store alert.checkIn.id so a repeat delivery is ignored.
  }
  response.statusCode = 204;
  response.end();
}
```

Read the body once, as text, and pass those exact bytes to `verifySpaSysWebhook`. A check-in that is already open does not send a second alert.

## Response fields

Client:

```json
{
  "count": 1,
  "clients": [
    {
      "id": "abc123",
      "name": "Amina Nakato",
      "phoneNumber": "0782000000, 0758000000",
      "phoneNumbers": ["0782000000", "0758000000"],
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

`phoneNumbers` are normalized Ugandan mobiles. `0782000000`, `782000000`, and `256782000000` find the same client, including when that number is one of several on the profile. Show `phoneNumber` when you want the stored text.

`createdAt` and `updatedAt` are UTC instants. `null` means SpaGym has no value. A missing birthday is `dateOfBirth: null`.

Check-ins:

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

`visitDate` is the Kampala calendar date. `checkedInAt` and `checkedOutAt` are UTC. Convert them to Africa/Kampala for display. `status` is `checked-in` or `checked-out`. A visit still open 12 hours after arrival is returned as checked out by `Automatic (12-hour timeout)`.

`count` is how many visits are in this response. `matched` is how many fit the filter. When `truncated` is true, more than 500 visits matched and this response has the newest 500. Narrow the branch, phone, client, or dates. Results are newest first.

Branches:

```json
{ "branches": [{ "id": "branch123", "name": "Kololo" }] }
```

## Errors

The client throws `SpaGymApiError`. Use `error.status`, `error.code`, and `error.message`.

| Status | Code | What you do |
| --- | --- | --- |
| 0 | `CONFIG` | Fix `SPAGYM_API_URL` or the key before sending traffic. |
| 0 | `NETWORK` | SpaGym was unreachable. The client already retried twice. Show a temporary failure. |
| 400 | `VALIDATION_ERROR` | Fix the query. This covers a short name, a bad date, an unknown branch, a bad id, or both phone and name. |
| 400 | `HTTPS_REQUIRED` | You called production SpaGym over HTTP. Use the `https://` origin. |
| 401 | `UNAUTHORIZED` | Stop calling. The key is missing, wrong, or not configured on SpaGym. Retrying burns the failure limit. |
| 404 | `CLIENT_NOT_FOUND` | That id is not a client. A phone search with no match is not a 404; it is an empty list. |
| 404 | `CHECK_IN_NOT_FOUND` | That client has no open visit to check out. |
| 404 | `NOT_FOUND` | The path is wrong. |
| 405 | `METHOD_NOT_ALLOWED` | That path does not accept this method. |
| 409 | `PHONE_IN_USE` | Another client already has the phone you tried to save. |
| 409 | `AMBIGUOUS_CLIENT` | The phone matches more than one client. Use the client id. |
| 429 | `RATE_LIMITED` | The client waits for `Retry-After` once, up to 60 seconds, then throws. Slow the screen refresh. |
| 500, 502, 503, 504 | `INTERNAL` or `REQUEST_FAILED` | The client retries 502, 503, and 504 up to twice. Then show a temporary failure. |

A 401 after a key that used to work means the SpaGym operator removed your old key during rotation. Ask for the current key. Do not keep a loop of failed guesses: 30 failures in a minute from your server are rejected until the minute passes.

## Key rotation

The SpaGym operator can accept two keys at once by setting:

```env
SPA_SYS_API_KEY=current-key,next-key
```

They deploy SpaGym, you change `SPA_SYS_API_KEY` to `next-key` and restart your server, then they remove `current-key`. Keys cannot contain commas or spaces. After the cutover, `ping()` with the old key returns 401 and `ping()` with the new key returns 200.

## Joint checklist

Do this with the SpaGym operator after both sides are deployed.

1. `ping()` returns `service: "SPA_SYS_API_V1"`.
2. A phone the operator knows returns that client’s name and birthday month and day.
3. A phone nobody has returns `count: 0`.
4. `listBranches()` matches the branch names on the SpaGym desk.
5. `listCheckIns({ date, branch })` for today matches the Spa check-ins screen for that branch. Remember that today is the Kampala date.
6. Opening one returned `clientId` shows that client’s visits, and a made-up id returns `CLIENT_NOT_FOUND`.
7. Your browser’s network panel shows requests to your server only.
8. A request with no key, run by the operator against SpaGym, returns 401. `DELETE` returns 405.
9. Updating a test client’s name by phone shows the new name on the SpaGym desk, and a phone that already belongs to someone else returns `PHONE_IN_USE`.
10. Checking that test client out by phone shows them as checked out on the Spa check-ins screen.
11. A real check-in sends one signed `client.checked_in` POST to your webhook. A second check-in while that visit is open does not send a second alert. An altered body fails `verifySpaSysWebhook()`.

## Troubleshooting

| What you see | What it usually means |
| --- | --- |
| `CONFIG` mentioning `/api` | `SPAGYM_API_URL` includes a path. Use the origin. |
| `CONFIG` mentioning 32 characters | The key was truncated or still says `paste-the-shared-secret-here`. |
| 401 on every call, including `ping()` | SpaGym’s `SPA_SYS_API_KEY` and your `SPA_SYS_API_KEY` differ, or SpaGym has not been redeployed since the key was set. |
| 400 `Unknown branch` | The filter does not match a current branch id or name. Refresh `listBranches()`. |
| 500 `Internal server error` | SpaGym reached the route and the key was accepted, then the read failed. The operator checks the Firebase Admin credentials. |
| Empty check-ins while the desk shows arrivals | The date or branch filter does not match. Compare `visitDate` and `branch` with the desk, using the Kampala date. |
| Birthday looks like this year | You read a field other than `dateOfBirth.month` and `dateOfBirth.day`. Ignore any year. |
| Check-in alert never arrives | SpaGym has no `SPA_SYS_WEBHOOK_URL`, the URL is not HTTPS, or your endpoint did not return a `2xx` within five seconds. |
| Alert signature never matches | Verify the raw request body, not a re-serialized object, with the same `SPA_SYS_WEBHOOK_SECRET`. |
