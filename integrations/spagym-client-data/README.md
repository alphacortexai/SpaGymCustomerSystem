# SpaGym client for the dependent system

Copy this folder into the server that needs SpaGym client and check-in data. The setup guide is [docs/DEPENDENT_SYSTEM_SETUP.md](../../docs/DEPENDENT_SYSTEM_SETUP.md).

`client.js` has no dependencies. It runs on Node.js 18 or newer. Your own server calls it. A browser must not import it, because the module sends `SPAGYM_CLIENT_DATA_API_KEY`.

```javascript
import { createSpaGymClient, SpaGymApiError } from './client.js';

const spagym = createSpaGymClient();

const service = await spagym.ping();
const branches = await spagym.listBranches();
const found = await spagym.findClients({ phone: '0782000000' });
const visits = await spagym.listClientCheckIns(found.clients[0].id, { date: '2026-10-24' });
```

`createSpaGymClient()` reads `SPAGYM_API_URL` and `SPAGYM_CLIENT_DATA_API_KEY` from the environment. See `env.example`. A wrong key throws `SpaGymApiError` with `status` 401 and does not retry. A rate limit waits for `Retry-After` once. A 502, 503, or 504 is retried up to twice.
