# SPA_SYS_API_V1 client for the dependent system

Copy this folder into the server that uses SPA_SYS_API_V1. The setup guide is [docs/DEPENDENT_SYSTEM_SETUP.md](../../docs/DEPENDENT_SYSTEM_SETUP.md). The contract is [docs/SPA_SYS_API_V1.md](../../docs/SPA_SYS_API_V1.md).

`client.js` has no dependencies beyond Node.js. It runs on Node.js 18 or newer. Your own server calls it. A browser must not import it, because the module sends `SPA_SYS_API_KEY`.

```javascript
import { createSpaGymClient, SpaGymApiError, verifySpaSysWebhook } from './client.js';

const spagym = createSpaGymClient();

const service = await spagym.ping();
const found = await spagym.findClients({ phone: '0782000000' });
await spagym.updateClient(found.clients[0].id, { name: 'Amina Nakato', dateOfBirth: { month: 3, day: 15 } });
await spagym.checkOut({ phone: '0782000000', staffName: 'Front desk' });
```

`createSpaGymClient()` reads `SPAGYM_API_URL` and `SPA_SYS_API_KEY` from the environment. See `env.example`. A wrong key throws `SpaGymApiError` with `status` 401 and does not retry. A rate limit waits for `Retry-After` once. A 502, 503, or 504 is retried up to twice on reads. Updates and check-outs are not retried after a `500`.

`verifySpaSysWebhook({ secret, timestamp, rawBody, signature })` checks a `client.checked_in` alert. Pass the raw body and `SPA_SYS_WEBHOOK_SECRET`. It rejects a timestamp older than five minutes and compares the signature in constant time. Persist `checkIn.id` and do not create a second visit, message, or reward when the same id arrives again.

A key without the permission for a call throws `SpaGymApiError` with `status` 403 and `code` `FORBIDDEN`. `LOOKUP_LIMITED` means the key looked up too many different clients in an hour.
