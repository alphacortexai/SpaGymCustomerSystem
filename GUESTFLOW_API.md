# GuestFlow ↔ SpaGym API integration

SpaGym is the system of record for client profiles and GuestFlow visits. GuestFlow calls SpaGym from its server process; the shared API key is never sent to the browser. Client and visit records are stored in SpaGym Firestore (`clients` and `guestflowVisits`).

## Configure SpaGym

1. Install dependencies and deploy the updated SpaGym app.
2. Configure a Firebase Admin service account for the server runtime. On managed hosting, set these server-only environment variables (do not prefix them with `NEXT_PUBLIC_`):
   - `FIREBASE_ADMIN_PROJECT_ID` (optional when the project id is already set)
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `FIREBASE_ADMIN_PRIVATE_KEY` (keep the private key's line breaks or use `\\n` escapes)
   - Alternatively, provide Application Default Credentials through `GOOGLE_APPLICATION_CREDENTIALS`.
3. Generate a long random shared secret and set `GUESTFLOW_API_KEY` in SpaGym. Set exactly the same value as `SPAGYM_API_KEY` in the GuestFlow server environment. Never place this key in a `NEXT_PUBLIC_*` variable or client-side code.
4. Optionally set `GUESTFLOW_DEFAULT_BRANCH` to a SpaGym branch name for new records created through GuestFlow.
5. Publish `firestore.rules` so authenticated SpaGym users with client-view permission can view the visit section, and client-edit permission can check clients out.

## Configure GuestFlow

Set the following on the **server** running GuestFlow:

```env
SPAGYM_API_URL=https://your-spagym-domain.example
SPAGYM_API_KEY=the-same-random-secret-as-GUESTFLOW_API_KEY
```

`SPAGYM_API_URL` is the SpaGym origin only (no `/api` suffix). Restart/redeploy GuestFlow after setting these values. The kiosk and front-desk dashboard use same-origin `/api/spagym/*` proxy routes, so the service key remains server-side.

## API reference

All SpaGym endpoints are under `/api/integrations/guestflow` and require `Authorization: Bearer <GUESTFLOW_API_KEY>`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/clients?phone=...` | Find exact phone matches |
| `GET` | `/clients?search=...&limit=...` | Search by name/phone; at most 100 results |
| `GET` | `/clients/lookup?phone=...` | Look up one client by normalized phone |
| `POST` | `/clients` | Create a client; returns an existing matching client rather than duplicating it |
| `POST` | `/check-ins` | Check in by phone; returns an existing same-day record on repeat submissions |
| `GET` | `/check-ins?date=YYYY-MM-DD` | Read the visit register for a date (Kampala date is used by default) |
| `POST` | `/check-ins/checkout` | Record check-out with JSON `{ "id": "<visit-id>", "staffName": "<optional>" }` |
| `POST` | `/check-ins/{visitId}/checkout` | REST-style checkout alias used by GuestFlow |
| `GET` | `/summary` | Return registered-client count and today's visit summary |

New clients created in GuestFlow require a name, phone, and birthday month/day; their SpaGym branch comes from `GUESTFLOW_DEFAULT_BRANCH` if set. Duplicate phone numbers return the existing client. GuestFlow records one check-in per client per Kampala calendar day; check-out is persisted by GuestFlow staff or in SpaGym's **Spa check-ins** section.

## Operational checks

- Confirm the configured branch name exists in SpaGym before using it.
- Keep the API key private and rotate both copies together if it is exposed.
- Deploy SpaGym and GuestFlow with the same secret before testing the GuestFlow kiosk.
- Use the signed-in SpaGym dashboard's **Spa check-ins** section to review arrivals and record departures.
